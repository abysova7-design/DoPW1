import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { publicAssistanceSchemaReady } from "@/lib/public-assistance-schema";
import { CIVIC_CATEGORY_LABELS, isCivicCategory } from "@/lib/civic-help";
import { executeCivicAssign } from "@/lib/civic-assign";

const SCHEMA_MSG =
  "База не обновлена: на сервере выполните npx prisma db push && npx prisma generate.";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  if (!(await publicAssistanceSchemaReady())) {
    return NextResponse.json({ error: SCHEMA_MSG }, { status: 503 });
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
    try {
      await prisma.publicAssistanceRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[public-assistance] PATCH cancel", e);
      return NextResponse.json({ error: SCHEMA_MSG }, { status: 503 });
    }
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        return executeCivicAssign(tx, {
          civic,
          employeeUserId,
          creatorUserId: user.id,
          catLabel,
        });
      });

      return NextResponse.json({ ok: true, dispatchCallId: result.id });
    } catch (e) {
      console.error("[public-assistance] PATCH assign", e);
      return NextResponse.json({ error: SCHEMA_MSG }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
