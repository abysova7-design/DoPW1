import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { addXp } from "@/lib/positions";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { ROAD_PATROL_XP_PER_ACTION } from "@/lib/road-patrol";

/** Активные перекрытия — для карты (все авторизованные). */
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const list = await prisma.roadClosure.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      lat: true,
      lng: true,
      title: true,
      description: true,
      createdAt: true,
      authorId: true,
      author: { select: { nickname: true, displayName: true } },
    },
  });
  return NextResponse.json({ closures: list });
}

/** Новое перекрытие — только дорожный патруль. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const title = String(body?.title ?? "").trim().slice(0, 120);
  const description =
    typeof body?.description === "string" ? body.description.trim().slice(0, 1000) : "";

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !title) {
    return NextResponse.json({ error: "Нужны координаты и краткое название перекрытия" }, { status: 400 });
  }

  const row = await prisma.roadClosure.create({
    data: {
      authorId: user.id,
      lat,
      lng,
      title,
      description: description || null,
    },
    select: {
      id: true,
      lat: true,
      lng: true,
      title: true,
      description: true,
      createdAt: true,
      authorId: true,
      author: { select: { nickname: true, displayName: true } },
    },
  });

  const { xp, level } = addXp(user.xp, user.level, ROAD_PATROL_XP_PER_ACTION);
  await prisma.user.update({ where: { id: user.id }, data: { xp, level } });

  return NextResponse.json({ closure: row, xpGained: ROAD_PATROL_XP_PER_ACTION, xp, level });
}
