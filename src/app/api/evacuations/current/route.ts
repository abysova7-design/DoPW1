import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

function isLinkedToActiveTow(
  ev: { taskId: string | null; task: { endedAt: Date | null; kind: string } | null },
): boolean {
  if (!ev.taskId || !ev.task) return false;
  return ev.task.kind === "TOW_TRUCK" && ev.task.endedAt == null;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const nonClosed = await prisma.evacuation.findMany({
    where: { userId: user.id, status: { not: "CLOSED" } },
    include: { task: { select: { endedAt: true, kind: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const current = nonClosed.find(isLinkedToActiveTow) ?? null;
  const stuckEvacuations = nonClosed
    .filter((e) => !isLinkedToActiveTow(e))
    .map((e) => {
      const { task, ...rest } = e;
      void task;
      return rest;
    });

  return NextResponse.json({
    evacuation: current,
    stuckEvacuations,
  });
}
