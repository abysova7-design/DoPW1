import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import {
  CIVIC_CATEGORY_LABELS,
  isCivicCategory,
} from "@/lib/civic-help";

/** Публичная статистика: смены без даты окончания */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("stats") === "1") {
    const shiftsOnDuty = await prisma.shift.count({
      where: { endedAt: null },
    });
    return NextResponse.json({ shiftsOnDuty });
  }

  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const requests = await prisma.publicAssistanceRequest.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ requests });
}

/** Создание обращения с сайта (без авторизации) */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const fullName = String(body?.fullName ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const lat = typeof body?.lat === "number" ? body.lat : Number.NaN;
  const lng = typeof body?.lng === "number" ? body.lng : Number.NaN;

  if (!fullName || fullName.length > 120) {
    return NextResponse.json(
      { error: "Укажите имя и фамилию (до 120 символов)" },
      { status: 400 },
    );
  }
  if (!isCivicCategory(category)) {
    return NextResponse.json({ error: "Некорректная категория" }, { status: 400 });
  }
  if (!description || description.length < 10 || description.length > 4000) {
    return NextResponse.json(
      { error: "Опишите задачу подробнее (от 10 до 4000 символов)" },
      { status: 400 },
    );
  }
  if (!phone || phone.length > 40) {
    return NextResponse.json({ error: "Укажите номер телефона" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Отметьте место на карте" },
      { status: 400 },
    );
  }

  const catLabel = CIVIC_CATEGORY_LABELS[category];
  const request = await prisma.publicAssistanceRequest.create({
    data: {
      fullName,
      category,
      description,
      phone,
      lat,
      lng,
      status: "OPEN",
    },
  });

  const dispatchers = await prisma.user.findMany({
    where: { OR: [{ isDispatcher: true }, { isAdmin: true }] },
    select: { id: true },
  });

  const title = `🆘 Гражданин: ${catLabel}`;
  const notifBody = `${fullName} · ${phone}\n${description.slice(0, 500)}${description.length > 500 ? "…" : ""}`;

  if (dispatchers.length > 0) {
    await prisma.notification.createMany({
      data: dispatchers.map((u) => ({
        userId: u.id,
        type: NotificationType.CIVIC_HELP,
        title,
        body: notifBody,
      })),
    });
  }

  return NextResponse.json({ ok: true, id: request.id });
}
