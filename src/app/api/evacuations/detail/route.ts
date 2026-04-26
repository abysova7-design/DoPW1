import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен id" }, { status: 400 });

  const evac = await prisma.evacuation.findUnique({
    where: { id },
    include: {
      user: { select: { nickname: true, displayName: true, positionRank: true } },
    },
  });

  if (!evac) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  return NextResponse.json({ evac });
}
