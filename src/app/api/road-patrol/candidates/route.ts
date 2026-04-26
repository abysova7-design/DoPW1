import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { hasRoadPatrolTask } from "@/lib/road-patrol-access";
import { canTakeRoadPatrol } from "@/lib/positions";

/** Сотрудники на смене без активной задачи — кандидаты в напарники (только для старшего патруля). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!(await hasRoadPatrolTask(user.id))) {
    return NextResponse.json({ error: "Только для дорожного патруля" }, { status: 403 });
  }

  const myGroup = await prisma.patrolGroup.findUnique({
    where: { leaderId: user.id },
    include: { partner: { select: { id: true, nickname: true, displayName: true } } },
  });

  const shifts = await prisma.shift.findMany({
    where: { endedAt: null },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          positionRank: true,
          isAdmin: true,
        },
      },
      tasks: { where: { endedAt: null }, take: 1 },
    },
  });

  const partnered = new Set(
    (await prisma.patrolGroup.findMany({ where: { partnerId: { not: null } }, select: { partnerId: true } }))
      .map((g) => g.partnerId)
      .filter(Boolean) as string[],
  );

  const candidates = shifts
    .filter(
      (s) =>
        s.userId !== user.id &&
        s.tasks.length === 0 &&
        !partnered.has(s.userId) &&
        canTakeRoadPatrol(s.user.positionRank, s.user.isAdmin),
    )
    .map((s) => ({
      id: s.user.id,
      nickname: s.user.nickname,
      displayName: s.user.displayName,
    }));

  return NextResponse.json({ candidates, currentPartner: myGroup?.partner ?? null });
}
