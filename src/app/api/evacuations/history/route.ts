import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const plate = (searchParams.get("plate") ?? "").trim().toUpperCase();
  if (plate.length < 2) return NextResponse.json({ evacuations: [] });

  const evacuations = await prisma.evacuation.findMany({
    where: {
      plate: { contains: plate },
      status: "CLOSED",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      user: { select: { nickname: true, displayName: true } },
    },
  });

  return NextResponse.json({ evacuations });
}
