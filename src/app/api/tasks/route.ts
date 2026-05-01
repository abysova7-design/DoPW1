import { NextResponse } from "next/server";
import type { TaskKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { TASK_KIND_LABELS, canTakeRoadPatrol } from "@/lib/positions";

const KINDS = new Set(Object.keys(TASK_KIND_LABELS));

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as TaskKind;
  if (!kind || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Неверный тип задачи" }, { status: 400 });
  }

  if (kind === "ROAD_PATROL" && !canTakeRoadPatrol(user.positionRank, user.isAdmin)) {
    return NextResponse.json(
      { error: "Дорожный патруль доступен со 2-го ранга (Engineer I) и выше" },
      { status: 403 },
    );
  }

  const shift = await prisma.shift.findFirst({
    where: { userId: user.id, endedAt: null },
  });
  if (!shift) {
    return NextResponse.json({ error: "Сначала начните смену" }, { status: 400 });
  }

  const active = await prisma.workTask.findFirst({
    where: { userId: user.id, endedAt: null },
  });
  if (active) {
    return NextResponse.json({ error: "Уже есть активная задача" }, { status: 400 });
  }

  const title = TASK_KIND_LABELS[kind] ?? kind;
  const task = await prisma.workTask.create({
    data: {
      userId: user.id,
      shiftId: shift.id,
      kind,
      title,
    },
  });

  if (kind === "TOW_TRUCK") {
    const orphan = await prisma.evacuation.findFirst({
      where: {
        userId: user.id,
        status: { in: ["DRAFT", "ACTIVE", "DELIVERED"] },
        OR: [
          { taskId: null },
          {
            task: {
              OR: [{ endedAt: { not: null } }, { kind: { not: "TOW_TRUCK" } }],
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (orphan) {
      await prisma.evacuation.update({
        where: { id: orphan.id },
        data: { taskId: task.id },
      });
    } else {
      await prisma.evacuation.create({
        data: {
          userId: user.id,
          taskId: task.id,
          plate: "",
          ownerNickname: "",
          violation: "",
          status: "DRAFT",
          photoUrls: "[]",
        },
      });
    }
  }

  return NextResponse.json({ task });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.action === "end") {
    const active = await prisma.workTask.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (!active) return NextResponse.json({ ok: true });
    await prisma.workTask.update({
      where: { id: active.id },
      data: { endedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
