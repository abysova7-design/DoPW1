import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { TASK_KIND_LABELS } from "@/lib/positions";

function isLinkedToActiveTow(
  ev: { taskId: string | null; task: { endedAt: Date | null; kind: string } | null },
): boolean {
  if (!ev.taskId || !ev.task) return false;
  return ev.task.kind === "TOW_TRUCK" && ev.task.endedAt == null;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const evacuationId = String(body?.evacuationId ?? "").trim();
  if (!evacuationId) {
    return NextResponse.json({ error: "Укажите эвакуацию" }, { status: 400 });
  }

  const shift = await prisma.shift.findFirst({
    where: { userId: user.id, endedAt: null },
  });
  if (!shift) {
    return NextResponse.json({ error: "Сначала начните смену" }, { status: 400 });
  }

  const activeOther = await prisma.workTask.findFirst({
    where: { userId: user.id, endedAt: null },
  });
  if (activeOther) {
    return NextResponse.json(
      { error: "Сначала завершите текущую задачу в кабинете" },
      { status: 400 },
    );
  }

  const ev = await prisma.evacuation.findFirst({
    where: { id: evacuationId, userId: user.id },
    include: { task: { select: { endedAt: true, kind: true } } },
  });
  if (!ev) {
    return NextResponse.json({ error: "Эвакуация не найдена" }, { status: 404 });
  }
  if (ev.status === "CLOSED") {
    return NextResponse.json({ error: "Уже закрыта" }, { status: 400 });
  }
  if (isLinkedToActiveTow(ev)) {
    return NextResponse.json({ error: "Эта эвакуация уже привязана к активной задаче" }, { status: 400 });
  }

  const title = TASK_KIND_LABELS.TOW_TRUCK ?? "Эвакуатор (буксир)";
  const task = await prisma.workTask.create({
    data: {
      userId: user.id,
      shiftId: shift.id,
      kind: "TOW_TRUCK",
      title,
    },
  });

  await prisma.evacuation.update({
    where: { id: ev.id },
    data: { taskId: task.id },
  });

  return NextResponse.json({ ok: true, taskId: task.id });
}
