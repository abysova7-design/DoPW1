import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { TASK_KIND_LABELS, canTakeRoadPatrol } from "@/lib/positions";
import { hasRoadPatrolTask } from "@/lib/road-patrol-access";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const asLeader = await prisma.patrolGroup.findUnique({
    where: { leaderId: user.id },
    include: {
      partner: { select: { id: true, nickname: true, displayName: true } },
    },
  });
  const asPartner = await prisma.patrolGroup.findFirst({
    where: { partnerId: user.id },
    include: {
      leader: { select: { id: true, nickname: true, displayName: true } },
    },
  });

  return NextResponse.json({
    asLeader: asLeader
      ? { partner: asLeader.partner, createdAt: asLeader.createdAt }
      : null,
    asPartner: asPartner
      ? { leader: asPartner.leader, createdAt: asPartner.createdAt }
      : null,
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!(await hasRoadPatrolTask(user.id))) {
    return NextResponse.json({ error: "Сначала возьмите задачу «Дорожный патруль»" }, { status: 400 });
  }

  const onlyPartner = await prisma.patrolGroup.findFirst({ where: { partnerId: user.id } });
  if (onlyPartner) {
    return NextResponse.json(
      { error: "Добавлять напарника может только старший пары" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const partnerId = String(body?.partnerId ?? "").trim();
  if (!partnerId || partnerId === user.id) {
    return NextResponse.json({ error: "Выберите напарника" }, { status: 400 });
  }

  const existing = await prisma.patrolGroup.findUnique({ where: { leaderId: user.id } });
  if (existing?.partnerId) {
    return NextResponse.json({ error: "Уже есть напарник. Сначала расформируйте пару." }, { status: 400 });
  }

  const partner = await prisma.user.findUnique({ where: { id: partnerId } });
  if (!partner) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  if (!canTakeRoadPatrol(partner.positionRank, partner.isAdmin)) {
    return NextResponse.json(
      { error: "В пару можно взять только сотрудника со 2-го ранга (Engineer I) и выше" },
      { status: 400 },
    );
  }

  const partnerShift = await prisma.shift.findFirst({
    where: { userId: partnerId, endedAt: null },
  });
  if (!partnerShift) {
    return NextResponse.json({ error: "Напарник должен быть на смене" }, { status: 400 });
  }

  const partnerTask = await prisma.workTask.findFirst({
    where: { userId: partnerId, endedAt: null },
  });
  if (partnerTask) {
    return NextResponse.json({ error: "У сотрудника уже есть активная задача" }, { status: 400 });
  }

  const otherPair = await prisma.patrolGroup.findFirst({ where: { partnerId } });
  if (otherPair) {
    return NextResponse.json({ error: "Сотрудник уже в другой паре" }, { status: 400 });
  }

  const title = TASK_KIND_LABELS.ROAD_PATROL ?? "Дорожный патруль 🛣️";

  await prisma.$transaction(async (tx) => {
    await tx.patrolGroup.upsert({
      where: { leaderId: user.id },
      create: { leaderId: user.id, partnerId },
      update: { partnerId },
    });
    await tx.workTask.create({
      data: {
        userId: partnerId,
        shiftId: partnerShift.id,
        kind: "ROAD_PATROL",
        title,
      },
    });
    await tx.notification.create({
      data: {
        userId: partnerId,
        type: NotificationType.TASK_ASSIGNED,
        title: "🛣️ Вы в паре дорожного патруля",
        body: `${user.nickname} добавил вас как напарника. Общая карта и отметки синхронизированы.`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

/** Расформировать пару: старший или напарник. */
export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const asLeader = await prisma.patrolGroup.findUnique({ where: { leaderId: user.id } });
  if (asLeader?.partnerId) {
    await prisma.$transaction(async (tx) => {
      await tx.workTask.updateMany({
        where: { userId: asLeader.partnerId!, endedAt: null, kind: "ROAD_PATROL" },
        data: { endedAt: new Date() },
      });
      await tx.patrolGroup.update({
        where: { leaderId: user.id },
        data: { partnerId: null },
      });
    });
    return NextResponse.json({ ok: true });
  }

  const asPartner = await prisma.patrolGroup.findFirst({ where: { partnerId: user.id } });
  if (asPartner) {
    await prisma.$transaction(async (tx) => {
      await tx.workTask.updateMany({
        where: { userId: user.id, endedAt: null, kind: "ROAD_PATROL" },
        data: { endedAt: new Date() },
      });
      await tx.patrolGroup.update({
        where: { id: asPartner.id },
        data: { partnerId: null },
      });
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Нет активной пары" }, { status: 400 });
}
