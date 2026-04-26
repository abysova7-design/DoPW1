import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { addXp } from "@/lib/positions";
import { ROAD_PATROL_XP_PER_ACTION } from "@/lib/road-patrol";

/** Внесение ТС в базу с панели патруля (без прав админа). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const plate = String(body?.plate ?? "").trim().toUpperCase();
  const model = typeof body?.model === "string" ? body.model.trim().slice(0, 120) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

  if (!plate) return NextResponse.json({ error: "Госномер обязателен" }, { status: 400 });

  try {
    const v = await prisma.vehicleRegistry.create({
      data: {
        plate,
        model: model || null,
        notes: notes
          ? `[Патруль ${user.nickname}] ${notes}`
          : `[Патруль ${user.nickname}]`,
      },
    });
    const { xp, level } = addXp(user.xp, user.level, ROAD_PATROL_XP_PER_ACTION);
    await prisma.user.update({ where: { id: user.id }, data: { xp, level } });
    return NextResponse.json({ vehicle: v, xpGained: ROAD_PATROL_XP_PER_ACTION });
  } catch {
    return NextResponse.json({ error: "Такой номер уже в базе или ошибка сохранения" }, { status: 400 });
  }
}
