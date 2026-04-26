import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { PATROL_CHECKPOINTS } from "@/lib/road-patrol";

/** Карта ситуации для патруля: смены, пинги, эвакуации, активные задачи (как у диспетчера). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  const activeShifts = await prisma.shift.findMany({
    where: { endedAt: null },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          positionRank: true,
          department: true,
          isDispatcher: true,
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  const workerIds = activeShifts.map((s) => s.userId);
  const activeEvacuations = await prisma.evacuation.findMany({
    where: {
      userId: { in: workerIds },
      status: { in: ["ACTIVE", "DELIVERED"] },
      closedAt: null,
    },
    select: { userId: true, status: true, plate: true, id: true },
  });
  const activeEvacMap = Object.fromEntries(
    activeEvacuations.map((e) => [e.userId, e]),
  );
  const activeTasks = await prisma.workTask.findMany({
    where: { userId: { in: workerIds }, endedAt: null },
    select: { userId: true, kind: true, title: true, startedAt: true },
  });
  const activeTaskMap = Object.fromEntries(activeTasks.map((t) => [t.userId, t]));

  const lastPings = await Promise.all(
    workerIds.map((id) =>
      prisma.locationPing.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );
  const pingMap = Object.fromEntries(workerIds.map((id, i) => [id, lastPings[i]]));

  const workers = activeShifts.map((s) => ({
    shiftId: s.id,
    shiftStartedAt: s.startedAt,
    user: s.user,
    lastPing: pingMap[s.userId] ?? null,
    activeEvacuation: activeEvacMap[s.userId] ?? null,
    activeTask: activeTaskMap[s.userId] ?? null,
  }));

  const closures = await prisma.roadClosure.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      lat: true,
      lng: true,
      title: true,
      description: true,
      createdAt: true,
      authorId: true,
      author: { select: { nickname: true, displayName: true } },
    },
  });

  const dutyRows =
    workerIds.length === 0
      ? []
      : await prisma.patrolCheckpointDuty.findMany({
          where: { userId: { in: workerIds } },
          include: { user: { select: { id: true, nickname: true, displayName: true } } },
        });
  const checkpointDuties = PATROL_CHECKPOINTS.map((c) => ({
    checkpointId: c.id,
    users: dutyRows.filter((d) => d.checkpointId === c.id).map((d) => d.user),
  }));

  return NextResponse.json({ workers, closures, checkpointDuties });
}
