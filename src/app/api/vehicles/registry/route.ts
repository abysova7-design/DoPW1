import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const PAGE = 20;
const MAX_TAKE = 100;

/** Список реестра ТС для диспетчера / админа (постранично). */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0", 10) || 0);
  let take = parseInt(searchParams.get("take") ?? String(PAGE), 10) || PAGE;
  take = Math.min(Math.max(1, take), MAX_TAKE);

  const rows = await prisma.vehicleRegistry.findMany({
    orderBy: { createdAt: "desc" },
    skip,
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const vehicles = hasMore ? rows.slice(0, take) : rows;

  return NextResponse.json({ vehicles, hasMore, skip, take: vehicles.length });
}
