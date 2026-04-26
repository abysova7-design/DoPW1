import { randomUUID } from "crypto";
import { NotificationType } from "@prisma/client";
import type { Prisma, PublicAssistanceRequest } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CIVIC_CATEGORY_LABELS, isCivicCategory } from "@/lib/civic-help";

export function buildCivicDispatchBody(
  civic: Pick<PublicAssistanceRequest, "fullName" | "phone" | "description" | "endLat" | "endLng">,
): string {
  let b = `Заявитель: ${civic.fullName}\nТелефон: ${civic.phone}\n\n${civic.description}`;
  if (civic.endLat != null && civic.endLng != null) {
    b += `\n\nТочка Б (назначение): ${Math.round(civic.endLat)}, ${Math.round(civic.endLng)}`;
  }
  return b;
}

/** Пользователь для поля creatorId при автоназначении (приказ портала). */
export async function pickPortalCreatorId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (admin) return admin.id;
  const disp = await prisma.user.findFirst({
    where: { isDispatcher: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return disp?.id ?? null;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Сотрудник на смене без активной задачи; ближе к (lat,lng) по последнему пингу. */
export async function pickNearestFreeWorker(
  refLat: number,
  refLng: number,
): Promise<string | null> {
  const activeShifts = await prisma.shift.findMany({
    where: { endedAt: null },
    select: { userId: true },
  });
  const workerIds = activeShifts.map((s) => s.userId);
  if (workerIds.length === 0) return null;

  const activeTasks = await prisma.workTask.findMany({
    where: { userId: { in: workerIds }, endedAt: null },
    select: { userId: true },
  });
  const busy = new Set(activeTasks.map((t) => t.userId));
  const freeIds = workerIds.filter((id) => !busy.has(id));
  if (freeIds.length === 0) return null;

  const lastPings = await Promise.all(
    freeIds.map((id) =>
      prisma.locationPing.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { lat: true, lng: true },
      }),
    ),
  );

  const scored = freeIds.map((id, i) => {
    const p = lastPings[i];
    const d = p ? dist2(p.lat, p.lng, refLat, refLng) : Number.POSITIVE_INFINITY;
    return { id, d };
  });
  scored.sort((a, b) => a.d - b.d);
  return scored[0]?.id ?? null;
}

export async function executeCivicAssign(
  tx: Prisma.TransactionClient,
  args: {
    civic: PublicAssistanceRequest;
    employeeUserId: string;
    creatorUserId: string;
    catLabel: string;
  },
) {
  const title = `[Гражданин] ${args.catLabel}`;
  const callBody = buildCivicDispatchBody(args.civic);
  const callId = randomUUID();
  const hasEnd =
    args.civic.endLat != null &&
    args.civic.endLng != null &&
    Number.isFinite(args.civic.endLat) &&
    Number.isFinite(args.civic.endLng);

  const call = await tx.dispatchCall.create({
    data: {
      id: callId,
      creatorId: args.creatorUserId,
      targetId: args.employeeUserId,
      title,
      body: callBody,
      lat: args.civic.lat,
      lng: args.civic.lng,
      ...(hasEnd ? { endLat: args.civic.endLat!, endLng: args.civic.endLng! } : {}),
    },
  });

  await tx.publicAssistanceRequest.update({
    where: { id: args.civic.id },
    data: {
      status: "ASSIGNED",
      assignedUserId: args.employeeUserId,
      dispatchCallId: call.id,
    },
  });

  await tx.notification.create({
    data: {
      userId: args.employeeUserId,
      type: NotificationType.DISPATCH,
      title: `📡 Диспетчер: ${title}`,
      body: callBody,
    },
  });

  return call;
}

/** Автоназначение только для категории «Логистика» (без клика диспетчера). */
export async function tryAutoAssignLogisticsCivic(civicId: string): Promise<boolean> {
  const civic = await prisma.publicAssistanceRequest.findUnique({ where: { id: civicId } });
  if (!civic || civic.status !== "OPEN" || civic.category !== "LOGISTICS") return false;

  const creatorId = await pickPortalCreatorId();
  if (!creatorId) return false;

  const assigneeId = await pickNearestFreeWorker(civic.lat, civic.lng);
  if (!assigneeId) return false;

  const catLabel = isCivicCategory(civic.category)
    ? CIVIC_CATEGORY_LABELS[civic.category]
    : civic.category;

  try {
    await prisma.$transaction(async (tx) => {
      await executeCivicAssign(tx, {
        civic,
        employeeUserId: assigneeId,
        creatorUserId: creatorId,
        catLabel,
      });
    });
    return true;
  } catch (e) {
    console.error("[civic-auto-assign]", e);
    return false;
  }
}
