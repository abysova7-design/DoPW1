import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    { notifications: items },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.action === "readAll") {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  const id = body?.id as string | undefined;
  if (id) {
    await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
