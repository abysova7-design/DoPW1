import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { randomUUID } from "crypto";

const BASE_CALL_SELECT = {
  id: true,
  title: true,
  body: true,
  status: true,
  lat: true,
  lng: true,
  endLat: true,
  endLng: true,
  createdAt: true,
  closedAt: true,
  creatorId: true,
  targetId: true,
} as const;

async function hasReportColumns() {
  try {
    const cols = await prisma.$queryRaw<Array<{ name: string }>>`PRAGMA table_info('DispatchCall')`;
    const names = new Set(cols.map((c) => c.name));
    return names.has("reportText") && names.has("reportAt") && names.has("reportById");
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const where =
    user.isDispatcher || user.isAdmin
      ? { status: { in: ["OPEN", "ACCEPTED", "ONSITE", "REPORTED"] } }
      : {
          OR: [
            { targetId: null, status: { in: ["OPEN", "ACCEPTED", "ONSITE", "REPORTED"] } },
            { targetId: user.id },
          ],
        };

  const reportCols = await hasReportColumns();
  const calls = await prisma.dispatchCall.findMany({
    where,
    select: {
      ...BASE_CALL_SELECT,
      ...(reportCols ? { reportText: true, reportAt: true, reportById: true } : {}),
      creator: { select: { nickname: true, displayName: true } },
      target: { select: { nickname: true, displayName: true } },
      ...(reportCols ? { reportBy: { select: { nickname: true, displayName: true } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const bodyText = String(body?.bodyText ?? "").trim();
  const targetId = typeof body?.targetId === "string" ? body.targetId : null;
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;

  if (!title || !bodyText) {
    return NextResponse.json({ error: "Заголовок и текст обязательны" }, { status: 400 });
  }

  const reportCols = await hasReportColumns();
  const endLat = typeof body?.endLat === "number" ? body.endLat : null;
  const endLng = typeof body?.endLng === "number" ? body.endLng : null;

  const call = await prisma.dispatchCall.create({
    data: {
      id: randomUUID(),
      creatorId: user.id,
      targetId,
      title,
      body: bodyText,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      endLat: endLat ?? undefined,
      endLng: endLng ?? undefined,
    },
    select: {
      ...BASE_CALL_SELECT,
      ...(reportCols ? { reportText: true, reportAt: true, reportById: true } : {}),
    },
  });

  if (targetId) {
    await prisma.notification.create({
      data: {
        userId: targetId,
        type: "DISPATCH",
        title: `📡 Диспетчер: ${title}`,
        body: bodyText,
      },
    });
  }

  return NextResponse.json({ call });
}
