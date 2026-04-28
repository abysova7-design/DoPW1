import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const ACTION_RU: Record<string, string> = {
  PATROL_CREATE: "Патруль · внесение в базу",
  ADMIN_CREATE: "Администратор · запись в реестр",
};

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [
    totalVehicles,
    eventsLast7d,
    audits,
    lastAudit,
    totalClosedEvac,
    evacuationsClosedLast7d,
    evacRows,
    lastEvac,
  ] = await Promise.all([
    prisma.vehicleRegistry.count(),
    prisma.vehicleRegistryAudit.count({ where: { createdAt: { gte: since7d } } }),
    prisma.vehicleRegistryAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        actor: { select: { nickname: true, displayName: true } },
        vehicle: { select: { plate: true, model: true } },
      },
    }),
    prisma.vehicleRegistryAudit.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { nickname: true, displayName: true } },
        vehicle: { select: { plate: true } },
      },
    }),
    prisma.evacuation.count({
      where: { status: "CLOSED", closedAt: { not: null } },
    }),
    prisma.evacuation.count({
      where: {
        status: "CLOSED",
        closedAt: { gte: since7d, not: null },
      },
    }),
    prisma.evacuation.findMany({
      where: { status: "CLOSED", closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 100,
      select: {
        id: true,
        plate: true,
        violation: true,
        closedAt: true,
        user: { select: { nickname: true, displayName: true } },
      },
    }),
    prisma.evacuation.findFirst({
      where: { status: "CLOSED", closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
      select: {
        plate: true,
        violation: true,
        closedAt: true,
        user: { select: { nickname: true, displayName: true } },
      },
    }),
  ]);

  const registryTimeline = audits.map((a) => ({
    id: `reg-${a.id}`,
    kind: "REGISTRY" as const,
    at: a.createdAt.toISOString(),
    plate: a.vehicle.plate,
    model: a.vehicle.model,
    headline: ACTION_RU[a.action] ?? a.action,
    detail: a.reason,
    actorNickname: a.actor.nickname,
    actorDisplayName: a.actor.displayName,
  }));

  const evacTimeline = evacRows.map((e) => ({
    id: `evac-${e.id}`,
    kind: "EVACUATION" as const,
    at: (e.closedAt as Date).toISOString(),
    plate: e.plate,
    model: null as string | null,
    headline: "Эвакуация · закрыта (штрафстоянка)",
    detail: e.violation,
    actorNickname: e.user.nickname,
    actorDisplayName: e.user.displayName,
  }));

  const timeline = [...registryTimeline, ...evacTimeline]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 150);

  return NextResponse.json({
    stats: {
      totalVehicles,
      registryAddsLast7Days: eventsLast7d,
      lastRegistryAdd: lastAudit
        ? {
            at: lastAudit.createdAt.toISOString(),
            plate: lastAudit.vehicle.plate,
            actorLabel: lastAudit.actor.displayName ?? lastAudit.actor.nickname,
            actionLabel: ACTION_RU[lastAudit.action] ?? lastAudit.action,
            reason: lastAudit.reason,
          }
        : null,
      totalEvacuationsClosed: totalClosedEvac,
      evacuationsClosedLast7Days: evacuationsClosedLast7d,
      lastEvacuationClosed: lastEvac
        ? {
            at: (lastEvac.closedAt as Date).toISOString(),
            plate: lastEvac.plate,
            actorLabel: lastEvac.user.displayName ?? lastEvac.user.nickname,
            violation: lastEvac.violation,
          }
        : null,
    },
    timeline,
  });
}
