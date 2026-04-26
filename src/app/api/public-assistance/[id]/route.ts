import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { CIVIC_CATEGORY_LABELS, isCivicCategory } from "@/lib/civic-help";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const civic = await prisma.publicAssistanceRequest.findUnique({
    where: { id },
  });
  if (!civic) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (action === "cancel") {
    if (civic.status !== "OPEN") {
      return NextResponse.json({ error: "Уже обработано" }, { status: 400 });
    }
    await prisma.publicAssistanceRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "assign") {
    const employeeUserId = String(body?.employeeUserId ?? "").trim();
    if (!employeeUserId) {
      return NextResponse.json({ error: "Выберите сотрудника" }, { status: 400 });
    }
    if (civic.status !== "OPEN") {
      return NextResponse.json({ error: "Уже назначено или закрыто" }, { status: 400 });
    }

    const employee = await prisma.user.findUnique({ where: { id: employeeUserId } });
    if (!employee) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 400 });
    }

    const catLabel = isCivicCategory(civic.category)
      ? CIVIC_CATEGORY_LABELS[civic.category]
      : civic.category;
    const title = `[Гражданин] ${catLabel}`;
    const callBody =
      `Заявитель: ${civic.fullName}\nТелефон: ${civic.phone}\n\n${civic.description}`;

    const callId = randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const call = await tx.dispatchCall.create({
        data: {
          id: callId,
          creatorId: user.id,
          targetId: employeeUserId,
          title,
          body: callBody,
          lat: civic.lat,
          lng: civic.lng,
        },
      });

      await tx.publicAssistanceRequest.update({
        where: { id },
        data: {
          status: "ASSIGNED",
          assignedUserId: employeeUserId,
          dispatchCallId: call.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: employeeUserId,
          type: NotificationType.DISPATCH,
          title: `📡 Диспетчер: ${title}`,
          body: callBody,
        },
      });

      return call;
    });

    return NextResponse.json({ ok: true, dispatchCallId: result.id });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
