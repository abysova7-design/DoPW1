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
  });
  if (!ev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.applyVehicleId) {
    const v = await prisma.vehicleRegistry.findUnique({
      where: { id: String(body.applyVehicleId) },
    });
    if (!v) {
      return NextResponse.json({ error: "Авто не в базе" }, { status: 400 });
    }
    const updated = await prisma.evacuation.update({
      where: { id },
      data: {
        plate: v.plate,
        description: [v.model, v.notes].filter(Boolean).join(" — ") || null,
        status: ev.status === "DRAFT" ? "ACTIVE" : ev.status,
      },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (typeof body.plate === "string" || typeof body.violation === "string") {
    const updated = await prisma.evacuation.update({
      where: { id },
      data: {
        ...(typeof body.plate === "string" ? { plate: body.plate } : {}),
        ...(typeof body.violation === "string" ? { violation: body.violation } : {}),
        ...(typeof body.description === "string"
          ? { description: body.description }
          : {}),
        status: ev.status === "DRAFT" ? "ACTIVE" : ev.status,
      },
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
    const updated = await prisma.evacuation.update({
      where: { id },
      data: { status: "DELIVERED" as EvacuationStatus },
    });
    return NextResponse.json({ evacuation: updated });
  }

  if (body.action === "close") {
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

    return NextResponse.json({ evacuation: updated, xpGain: gain, xp, level });
  }

  return NextResponse.json({ error: "Нет изменений" }, { status: 400 });
}
