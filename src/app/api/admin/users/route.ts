import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { PositionRank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";
import { RANK_ORDER, RANK_LABELS } from "@/lib/positions";
import { postOrder } from "@/lib/channels";

function genCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      isAdmin: true,
      isDispatcher: true,
      positionRank: true,
      department: true,
      displayName: true,
      xp: true,
      level: true,
      towTruckCert: true,
      driverCert: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const nickname = String(body?.nickname ?? "").trim();
  const positionRank = body?.positionRank as PositionRank | undefined;
  const department =
    typeof body?.department === "string" ? body.department.trim() : "";
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!nickname) {
    return NextResponse.json({ error: "Ник обязателен" }, { status: 400 });
  }
  if (!positionRank || !RANK_ORDER.includes(positionRank)) {
    return NextResponse.json({ error: "Неверная должность" }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { nickname } });
  if (exists) {
    return NextResponse.json({ error: "Такой ник уже есть" }, { status: 400 });
  }

  const plainCode = genCode();
  const codeHash = await bcrypt.hash(plainCode, 10);

  const user = await prisma.user.create({
    data: {
      nickname,
      codeHash,
      isAdmin: false,
      positionRank,
      department: department || null,
      displayName: displayName || null,
    },
    select: {
      id: true,
      nickname: true,
      positionRank: true,
      department: true,
      displayName: true,
    },
  });

  await postOrder(
    `🆕 Приказ о приёме на службу — ${nickname}`,
    `Принят(а) на службу в Департамент общественных работ и транспорта.
Сотрудник: ${nickname}${displayName ? ` (${displayName})` : ""}
Должность: ${RANK_LABELS[positionRank]}
Отдел: ${department || "не указан"}
Приказ издал: ${admin.nickname}
Дата: ${new Date().toLocaleString("ru-RU")}`,
    "🆕",
    admin.id,
  );

  return NextResponse.json({ user, oneTimeCode: plainCode });
}
