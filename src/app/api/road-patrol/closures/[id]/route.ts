import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const row = await prisma.roadClosure.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (!row.active) return NextResponse.json({ error: "Уже снято" }, { status: 400 });

  if (action === "close") {
    const allowed = row.authorId === user.id || user.isDispatcher || user.isAdmin;
    if (!allowed) {
      return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    }
    await prisma.roadClosure.update({
      where: { id },
      data: { active: false, closedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
