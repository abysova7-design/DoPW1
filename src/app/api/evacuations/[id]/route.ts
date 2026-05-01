import { NextResponse } from "next/server";
import type { EvacuationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { addXp } from "@/lib/positions";

function parsePhotos(raw: string): string[] {
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { id } = await ctx.params;
  const ev = await prisma.evacuation.findFirst({
    where: { id, userId: user.id },
    include: { task: { select: { id: true, endedAt: true, kind: true } } },
  });
  if (!ev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const linkedActiveTow =
    ev.taskId &&
    ev.task &&
    ev.task.kind === "TOW_TRUCK" &&
    ev.task.endedAt == null;

  const body = await req.json().catch(() => ({}));

  if (body.action === "abandon") {
    if (ev.status === "CLOSED") {
      return NextResponse.json({ error: "Уже закрыта" }, { status: 400 });
    }
    if (linkedActiveTow) {
      return NextResponse.json(
        {
          error:
            "Эвакуация привязана к активной задаче. Завершите задачу в кабинете или пройдите штатное закрытие тикета.",
        },
        { status: 400 },
      );
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const stamp = `[Снято с контроля] ${new Date().toLocaleString("ru-RU")}${reason ? ` — ${reason}` : ""}`;
    const nextDesc = ev.description ? `${ev.description}\n\n${stamp}` : stamp;
    await prisma.evacuation.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        description: nextDesc.slice(0, 4000),
      },
    });
    if (ev.taskId && ev.task && ev.task.endedAt == null) {
      await prisma.workTask.update({
        where: { id: ev.taskId },
        data: { endedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.applyVehicleId) {
    const v = await prisma.vehicleRegistry.findUnique({
      where: { id: String(body.applyVehicleId) },
    });
    if (!v) {
      return NextResponse.json({ error: "Авто не в базе" }, { status: 400 });
    }
    const descParts = [v.model, v.owner, v.notes].filter(Boolean);
    const updated = await prisma.evacuation.update({
      where: { id },
      data: {
        plate: v.plate,
        ...(v.owner ? { ownerNickname: v.owner } : {}),
        description: descParts.length ? descParts.join(" — ") : null,
      },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (
    typeof body.plate === "string" ||
    typeof body.violation === "string" ||
    typeof body.pickupLat === "number" ||
    typeof body.pickupLng === "number" ||
    typeof body.ownerNickname === "string"
  ) {
    const updated = await prisma.evacuation.update({
      where: { id },
      data: {
        ...(typeof body.plate === "string" ? { plate: body.plate } : {}),
        ...(typeof body.ownerNickname === "string"
          ? { ownerNickname: body.ownerNickname }
          : {}),
        ...(typeof body.pickupLat === "number" ? { pickupLat: body.pickupLat } : {}),
        ...(typeof body.pickupLng === "number" ? { pickupLng: body.pickupLng } : {}),
        ...(typeof body.violation === "string" ? { violation: body.violation } : {}),
        ...(typeof body.description === "string"
          ? { description: body.description }
          : {}),
      },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (body.action === "createTicket") {
    const pickupLat = (ev as { pickupLat?: number | null }).pickupLat;
    const pickupLng = (ev as { pickupLng?: number | null }).pickupLng;
    if (!ev.plate || !ev.violation) {
      return NextResponse.json(
        { error: "Заполните номер и нарушение, затем сохраните" },
        { status: 400 },
      );
    }
    if (pickupLat == null || pickupLng == null) {
      return NextResponse.json(
        { error: "Отметьте точку эвакуации на карте" },
        { status: 400 },
      );
    }
    const updated = await prisma.evacuation.update({
      where: { id },
      data: { status: "ACTIVE" as EvacuationStatus },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (Array.isArray(body.photoUrls)) {
    const incoming = body.photoUrls.filter((x: unknown) => typeof x === "string");
    const merged = [...parsePhotos(ev.photoUrls), ...incoming].slice(0, 12);
    const updated = await prisma.evacuation.update({
      where: { id },
      data: { photoUrls: JSON.stringify(merged) },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (body.action === "deliver") {
    if (!ev.plate || !ev.violation) {
      return NextResponse.json(
        { error: "Сначала заполните номер и нарушение" },
        { status: 400 },
      );
    }
    if (parsePhotos(ev.photoUrls).length < 1) {
      return NextResponse.json(
        { error: "Сначала загрузите хотя бы одно фото" },
        { status: 400 },
      );
    }
    const updated = await prisma.evacuation.update({
      where: { id },
      data: { status: "DELIVERED" as EvacuationStatus },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (body.action === "close") {
    if (ev.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Сначала начните перевозку (статус «В пути»)" },
        { status: 400 },
      );
    }
    if (!ev.plate || !ev.violation) {
      return NextResponse.json(
        { error: "Заполните номер и нарушение" },
        { status: 400 },
      );
    }
    const photos = parsePhotos(ev.photoUrls);
    if (photos.length < 1) {
      return NextResponse.json(
        { error: "Добавьте хотя бы одно фото" },
        { status: 400 },
      );
    }

    const updated = await prisma.evacuation.update({
      where: { id },
      data: {
        status: "CLOSED" as EvacuationStatus,
        closedAt: new Date(),
      },
    });

    const gain = 45 + Math.min(30, photos.length * 5);
    const { xp, level } = addXp(user.xp, user.level, gain);
    await prisma.user.update({
      where: { id: user.id },
      data: { xp, level },
    });

    if (ev.taskId) {
      await prisma.workTask.update({
        where: { id: ev.taskId },
        data: { endedAt: new Date() },
      });
    }
    await prisma.locationPing.create({
      data: {
        userId: user.id,
        lat: 1794,
        lng: 4151,
        label: "Штрафстоянка",
      },
    });

    return NextResponse.json({ evacuation: updated, xpGain: gain, xp, level });
  }

  return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
}
