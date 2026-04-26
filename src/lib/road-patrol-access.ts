import { prisma } from "@/lib/prisma";

/** Активная задача «дорожный патруль» у пользователя или у старшего пары (напарник). */
export async function roadPatrolAccessUserId(userId: string): Promise<string | null> {
  const own = await prisma.workTask.findFirst({
    where: { userId, endedAt: null, kind: "ROAD_PATROL" },
    select: { userId: true },
  });
  if (own) return userId;

  const asPartner = await prisma.patrolGroup.findFirst({
    where: { partnerId: userId },
    select: { leaderId: true },
  });
  if (!asPartner) return null;
  const leaderTask = await prisma.workTask.findFirst({
    where: { userId: asPartner.leaderId, endedAt: null, kind: "ROAD_PATROL" },
  });
  return leaderTask ? asPartner.leaderId : null;
}

export async function hasRoadPatrolTask(userId: string): Promise<boolean> {
  const t = await prisma.workTask.findFirst({
    where: { userId, endedAt: null, kind: "ROAD_PATROL" },
  });
  return !!t;
}
