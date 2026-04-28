import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { normalizePlateInput } from "@/lib/plate-normalize";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const qRaw = (searchParams.get("q") ?? "").trim().toUpperCase();
  const qCompact = normalizePlateInput(qRaw);
  if (qCompact.length < 2) {
    return NextResponse.json({ vehicles: [] });
  }

  let take = parseInt(searchParams.get("take") ?? "20", 10) || 20;
  take = Math.min(Math.max(1, take), user.isDispatcher || user.isAdmin ? 100 : 40);

  const plateOr = [
    { plate: { contains: qRaw } },
    ...(qCompact !== qRaw ? [{ plate: { contains: qCompact } }] : []),
  ];

  const vehicles = await prisma.vehicleRegistry.findMany({
    where: {
      OR: [
        ...plateOr,
        { model: { contains: qRaw } },
        ...(user.isDispatcher || user.isAdmin
          ? ([{ owner: { contains: qRaw } }] as const)
          : []),
      ],
    },
    take,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ vehicles });
}
