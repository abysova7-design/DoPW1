import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = body?.userId as string | undefined;
  const title = String(body?.title ?? "").trim() || "Вызов на базу";
  const message = String(body?.message ?? "").trim() || "Срочно явитесь на базу ДОР.";

  if (!userId) {
    return NextResponse.json({ error: "Нужен userId" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  const n = await prisma.notification.create({
    data: {
      userId: target.id,
      type: "CALL_BASE",
      title,
      body: message,
    },
  });

  return NextResponse.json({ notification: n });
}
