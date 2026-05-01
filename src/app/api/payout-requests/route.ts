import { NextResponse } from "next/server";
import type { PayoutRequestKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const KINDS = new Set<PayoutRequestKind>(["MATERIAL_HELP", "EVACUATION_PAY", "OTHER"]);

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const items = await prisma.payoutRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ requests: items });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as PayoutRequestKind;
  if (!kind || !KINDS.has(kind)) {
    return NextResponse.json({ error: "Некорректный тип заявки" }, { status: 400 });
  }

  const details = String(body?.details ?? "").trim();
  if (details.length < 15 || details.length > 4000) {
    return NextResponse.json(
      { error: "Опишите основание подробно (от 15 до 4000 символов)" },
      { status: 400 },
    );
  }

  const amountNote =
    typeof body?.amountNote === "string" ? body.amountNote.trim().slice(0, 200) : null;

  const row = await prisma.payoutRequest.create({
    data: {
      userId: user.id,
      kind,
      details,
      amountNote: amountNote || null,
    },
  });

  const admins = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (admins.length > 0) {
    const kindRu =
      kind === "MATERIAL_HELP"
        ? "материальная помощь"
        : kind === "EVACUATION_PAY"
          ? "эвакуации"
          : "прочая выплата";
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "PAYOUT_REQUEST",
        title: "💸 Новая заявка на выплату",
        body: `${user.nickname} · ${kindRu}\n${details.slice(0, 400)}${details.length > 400 ? "…" : ""}`,
      })),
    });
  }

  return NextResponse.json({ request: row });
}
