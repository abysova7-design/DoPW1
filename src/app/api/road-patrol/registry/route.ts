import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { addXp } from "@/lib/positions";
import { ROAD_PATROL_XP_PER_ACTION } from "@/lib/road-patrol";

const MAX_PHOTO_LEN = 900_000;

function isDataImageUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s);
}

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
  const owner = String(body?.owner ?? "").trim().slice(0, 200);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : "";

  if (!plate) return NextResponse.json({ error: "Госномер обязателен" }, { status: 400 });
  if (!owner) return NextResponse.json({ error: "Укажите владельца ТС" }, { status: 400 });
  if (!photoUrl || !isDataImageUrl(photoUrl)) {
    return NextResponse.json({ error: "Прикрепите фото ТС (изображение)" }, { status: 400 });
  }
  if (photoUrl.length > MAX_PHOTO_LEN) {
    return NextResponse.json({ error: "Файл фото слишком большой — сожмите или выберите другое" }, { status: 400 });
  }

  const noteParts = [
    `Реестр: ${plate}`,
    model ? `Модель: ${model}` : null,
    `Владелец: ${owner}`,
    notes ? `Примечания: ${notes}` : null,
  ].filter(Boolean);
  const reportNote = noteParts.join("\n");

  try {
    const { vehicle, xp, level } = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicleRegistry.create({
        data: {
          plate,
          model: model || null,
          owner,
          photoUrl,
          notes: notes
            ? `[Патруль ${user.nickname}] ${notes}`
            : `[Патруль ${user.nickname}]`,
        },
      });

      await tx.roadPatrolReport.create({
        data: {
          authorId: user.id,
          kind: "REGISTRY_ENTRY",
          note: reportNote,
          status: "PENDING",
        },
      });

      const xpRes = addXp(user.xp, user.level, ROAD_PATROL_XP_PER_ACTION);
      await tx.user.update({
        where: { id: user.id },
        data: { xp: xpRes.xp, level: xpRes.level },
      });

      return { vehicle: v, xp: xpRes.xp, level: xpRes.level };
    });

    const dispatchers = await prisma.user.findMany({
      where: { OR: [{ isDispatcher: true }, { isAdmin: true }] },
      select: { id: true },
    });
    if (dispatchers.length > 0) {
      try {
        await prisma.notification.createMany({
          data: dispatchers.map((d) => ({
            userId: d.id,
            type: NotificationType.ROAD_PATROL_REPORT,
            title: "🛣️ Внесение ТС в базу",
            body: `${user.nickname}: ${plate} · ${owner}`.slice(0, 500),
          })),
        });
      } catch (e) {
        console.error("[road-patrol/registry] notifications", e);
      }
    }

    return NextResponse.json({
      vehicle,
      xpGained: ROAD_PATROL_XP_PER_ACTION,
      xp,
      level,
    });
  } catch {
    return NextResponse.json({ error: "Такой номер уже в базе или ошибка сохранения" }, { status: 400 });
  }
}
