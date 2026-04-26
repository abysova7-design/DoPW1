import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim() || "Общий вызов";
  const message = String(body?.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Текст сообщения обязателен" }, { status: 400 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });

  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      type: "BROADCAST" as const,
      title,
      body: message,
    })),
  });

  return NextResponse.json({ sent: users.length });
}
