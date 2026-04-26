import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчер" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim().slice(0, 500) : "";

  const rep = await prisma.roadPatrolReport.findUnique({
    where: { id },
    include: { author: { select: { id: true, nickname: true } } },
  });
  if (!rep) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  if (action === "approve") {
    await prisma.roadPatrolReport.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    });
    await prisma.notification.create({
      data: {
        userId: rep.authorId,
        type: NotificationType.SYSTEM,
        title: "🛣️ Отчёт принят",
        body: `Диспетчер принял отчёт (${rep.kind}).${reviewNote ? ` Комментарий: ${reviewNote}` : ""}`,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    await prisma.roadPatrolReport.update({
      where: { id },
      data: {
        status: "NEEDS_WORK",
        reviewerId: user.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || "Требуется доработка",
      },
    });
    await prisma.notification.create({
      data: {
        userId: rep.authorId,
        type: NotificationType.SYSTEM,
        title: "🛣️ Отчёт возвращён",
        body: `Диспетчер вернул отчёт на доработку.${reviewNote ? ` ${reviewNote}` : ""}`,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
