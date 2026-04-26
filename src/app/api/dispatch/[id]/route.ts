import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const BASE_CALL_SELECT = {
  id: true,
  title: true,
  body: true,
  status: true,
  lat: true,
  lng: true,
  createdAt: true,
  closedAt: true,
  creatorId: true,
  targetId: true,
} as const;

async function hasReportColumns() {
  try {
    const cols = await prisma.$queryRaw<Array<{ name: string }>>`PRAGMA table_info('DispatchCall')`;
    const names = new Set(cols.map((c) => c.name));
    return names.has("reportText") && names.has("reportAt") && names.has("reportById");
  } catch {
    return false;
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { id } = await ctx.params;
  const call = await prisma.dispatchCall.findUnique({ where: { id } });
  if (!call) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const reportCols = await hasReportColumns();

  if (action === "accept") {
    if (call.targetId && call.targetId !== user.id) {
      return NextResponse.json({ error: "Не ваш вызов" }, { status: 403 });
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: { status: "ACCEPTED", targetId: call.targetId ?? user.id },
      select: BASE_CALL_SELECT,
    });
    return NextResponse.json({ call: updated });
  }

  if (action === "done") {
    if (!user.isDispatcher && !user.isAdmin) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: { status: "DONE", closedAt: new Date() },
      select: BASE_CALL_SELECT,
    });
    return NextResponse.json({ call: updated });
  }

  if (action === "report") {
    if (!reportCols) {
      return NextResponse.json(
        { error: "Требуется обновление БД (prisma db push на сервере)" },
        { status: 503 },
      );
    }
    if (call.targetId !== user.id && !user.isDispatcher && !user.isAdmin) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const reportText = String(body?.reportText ?? "").trim();
    if (reportText.length < 8) {
      return NextResponse.json(
        { error: "Опишите результат подробнее (минимум 8 символов)" },
        { status: 400 },
      );
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: {
        status: "REPORTED",
        reportText: reportText.slice(0, 2000),
        reportAt: new Date(),
        reportById: user.id,
      },
      select: {
        ...BASE_CALL_SELECT,
        reportText: true,
        reportAt: true,
        reportById: true,
      },
    });
    return NextResponse.json({ call: updated });
  }

  if (action === "onsite") {
    if (
      call.targetId !== user.id &&
      !user.isDispatcher &&
      !user.isAdmin
    ) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: { status: "ONSITE" },
      select: BASE_CALL_SELECT,
    });
    if (typeof call.lat === "number" && typeof call.lng === "number") {
      await prisma.locationPing.create({
        data: {
          userId: user.id,
          lat: call.lat,
          lng: call.lng,
          label: "На месте вызова",
        },
      });
    }
    return NextResponse.json({ call: updated });
  }

  if (action === "cancel") {
    if (!user.isDispatcher && !user.isAdmin && call.creatorId !== user.id) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: { status: "CANCELLED", closedAt: new Date() },
      select: BASE_CALL_SELECT,
    });
    return NextResponse.json({ call: updated });
  }

  if (action === "reopen") {
    if (!reportCols) {
      return NextResponse.json(
        { error: "Требуется обновление БД (prisma db push на сервере)" },
        { status: 503 },
      );
    }
    if (!user.isDispatcher && !user.isAdmin) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    const updated = await prisma.dispatchCall.update({
      where: { id },
      data: {
        status: "OPEN",
        reportText: null,
        reportAt: null,
        reportById: null,
      },
    });
    return NextResponse.json({ call: updated });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
