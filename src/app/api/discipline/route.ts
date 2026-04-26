import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { canIssueDiscipline, RANK_LABELS } from "@/lib/positions";
import { postOrder } from "@/lib/channels";

const TYPES = ["AWARD", "REPRIMAND"] as const;

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId") ?? user.id;

  if (
    targetId !== user.id &&
    !canIssueDiscipline(user.positionRank) &&
    !user.isAdmin
  ) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const records = await prisma.disciplineRecord.findMany({
    where: { targetId },
    orderBy: { createdAt: "desc" },
    include: {
      issuer: {
        select: {
          nickname: true,
          displayName: true,
          positionRank: true,
        },
      },
    },
  });

  return NextResponse.json({ records });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
    }
    if (!canIssueDiscipline(user.positionRank) && !user.isAdmin) {
      return NextResponse.json(
        { error: "Только Sub Director и выше" },
        { status: 403 },
      );
    }

    const raw = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
    }

    const targetId = String(body.userId ?? "").trim();
    const type = body.type as (typeof TYPES)[number];
    const reason = String(body.reason ?? "").trim();

    if (!targetId || !TYPES.includes(type) || !reason) {
      return NextResponse.json(
        { error: "Нужны userId, type (AWARD/REPRIMAND) и reason" },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const record = await prisma.disciplineRecord.create({
      data: { targetId, issuerId: user.id, type, reason },
    });

    const typeLabel = type === "AWARD" ? "🏆 ПООЩРЕНИЕ" : "⚠️ ВЫГОВОР";
    const issuerLabel = user.displayName ?? user.nickname;
    const issuerRank = RANK_LABELS[user.positionRank] ?? user.positionRank;

    await prisma.notification.create({
      data: {
        userId: targetId,
        type: "SYSTEM",
        title: `${typeLabel} от ${issuerLabel}`,
        body: reason,
      },
    });

    await postOrder(
      `${typeLabel} — ${target.nickname}`,
      `Сотрудник: ${target.nickname} (${target.displayName ?? "—"})
Тип: ${typeLabel}
Основание: ${reason}
Выдал: ${issuerLabel} · ${issuerRank}
Дата: ${new Date().toLocaleString("ru-RU")}`,
      type === "AWARD" ? "🏆" : "⚠️",
      user.id,
    );

    return NextResponse.json({ record });
  } catch (e) {
    console.error("discipline POST", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка оформления приказа" },
      { status: 500 },
    );
  }
}
