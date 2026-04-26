import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toUpperCase();
  if (q.length < 2) {
    return NextResponse.json({ vehicles: [] });
  }

  const vehicles = await prisma.vehicleRegistry.findMany({
    where: {
      OR: [
        { plate: { contains: q } },
        { model: { contains: q } },
      ],
    },
    take: 20,
  });

  return NextResponse.json({ vehicles });
}
