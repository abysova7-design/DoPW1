import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const open = await prisma.shift.findFirst({
    where: { userId: user.id, endedAt: null },
    orderBy: { startedAt: "desc" },
    include: {
      tasks: {
        where: { endedAt: null },
        take: 5,
        orderBy: { startedAt: "desc" },
      },
    },
  });

  return NextResponse.json({ shift: open });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  if (action === "start") {
    const existing = await prisma.shift.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (existing) {
      return NextResponse.json({ shift: existing });
    }
    const shift = await prisma.shift.create({
      data: { userId: user.id },
    });
    return NextResponse.json({ shift });
  }

  if (action === "end") {
    const open = await prisma.shift.findFirst({
      where: { userId: user.id, endedAt: null },
    });
    if (!open) return NextResponse.json({ ok: true });
    await prisma.workTask.updateMany({
      where: { shiftId: open.id, endedAt: null },
      data: { endedAt: new Date() },
    });
    await prisma.shift.update({
      where: { id: open.id },
      data: { endedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
