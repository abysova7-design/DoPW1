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

  const [totalVehicles, eventsLast7d, audits, lastEvent] = await Promise.all([
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
  ]);

  return NextResponse.json({
    stats: {
      totalVehicles,
      registryAddsLast7Days: eventsLast7d,
      lastAdd: lastEvent
        ? {
            at: lastEvent.createdAt.toISOString(),
            plate: lastEvent.vehicle.plate,
            actorLabel: lastEvent.actor.displayName ?? lastEvent.actor.nickname,
            actionLabel: ACTION_RU[lastEvent.action] ?? lastEvent.action,
            reason: lastEvent.reason,
          }
        : null,
    },
    events: audits.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      plate: a.vehicle.plate,
      model: a.vehicle.model,
      action: a.action,
      actionLabel: ACTION_RU[a.action] ?? a.action,
      reason: a.reason,
      actorNickname: a.actor.nickname,
      actorDisplayName: a.actor.displayName,
    })),
  });
}
