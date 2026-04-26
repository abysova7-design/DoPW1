import { NextResponse } from "next/server";
import type { PositionRank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";
import { RANK_ORDER, RANK_LABELS } from "@/lib/positions";
import { postOrder } from "@/lib/channels";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const updateData: Record<string, unknown> = {};
  const changes: string[] = [];

  if (
    typeof body.positionRank === "string" &&
    RANK_ORDER.includes(body.positionRank as PositionRank) &&
    body.positionRank !== target.positionRank
  ) {
    const oldLabel = RANK_LABELS[target.positionRank];
    const newLabel = RANK_LABELS[body.positionRank as PositionRank];
    const direction =
      RANK_ORDER.indexOf(body.positionRank as PositionRank) >
      RANK_ORDER.indexOf(target.positionRank)
        ? "⬆️ ПОВЫШЕНИЕ"
        : "⬇️ ПОНИЖЕНИЕ";

    updateData.positionRank = body.positionRank;
    changes.push(
      `${direction} в должности: «${oldLabel}» → «${newLabel}»`,
    );
  }

  if (
    typeof body.department === "string" &&
    body.department.trim() !== (target.department ?? "")
  ) {
    const newDept = body.department.trim() || null;
    updateData.department = newDept;
    if (newDept) {
      changes.push(
        `Перевод в отдел: «${target.department ?? "—"}» → «${newDept}»`,
      );
    }
  }

  if (typeof body.isDispatcher === "boolean") {
    updateData.isDispatcher = body.isDispatcher;
    changes.push(
      body.isDispatcher
        ? "Назначен диспетчером"
        : "Снята роль диспетчера",
    );
  }

  if (typeof body.displayName === "string") {
    updateData.displayName = body.displayName.trim() || null;
  }

  if (typeof body.towTruckCert === "boolean") {
    updateData.towTruckCert = body.towTruckCert;
    changes.push(body.towTruckCert ? "Выдан допуск на эвакуатор" : "Отозван допуск на эвакуатор");
  }

  if (typeof body.driverCert === "boolean") {
    updateData.driverCert = body.driverCert;
    changes.push(body.driverCert ? "Выдан допуск водителя" : "Отозван допуск водителя");
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
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
    },
  });

  for (const change of changes) {
    await postOrder(
      `Приказ по личному составу — ${target.nickname}`,
      `Сотрудник: ${target.nickname} (${target.displayName ?? "—"})
Изменение: ${change}
Издал приказ: ${admin.nickname}
Дата: ${new Date().toLocaleString("ru-RU")}`,
      "📋",
      admin.id,
    );

    await prisma.notification.create({
      data: {
        userId: target.id,
        type: "SYSTEM",
        title: "📋 Приказ по личному составу",
        body: change,
      },
    });
  }

  return NextResponse.json({ user: updated });
}
