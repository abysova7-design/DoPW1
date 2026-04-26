import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const last = await prisma.locationPing.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ last });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Нужны координаты" }, { status: 400 });
  }

  const label = typeof body?.label === "string" ? body.label.slice(0, 120) : null;

  const ping = await prisma.locationPing.create({
    data: {
      userId: user.id,
      lat,
      lng,
      label: label ?? undefined,
    },
  });

  const IMG = 6000;
  const clamp = (v: number) => Math.max(0, Math.min(IMG, v));
  const group = await prisma.patrolGroup.findFirst({
    where: { OR: [{ leaderId: user.id }, { partnerId: user.id }] },
  });
  if (group) {
    const buddyId =
      group.leaderId === user.id ? group.partnerId : group.leaderId;
    if (buddyId) {
      const ox = group.leaderId === user.id ? 18 : -18;
      const oy = group.leaderId === user.id ? 18 : -18;
      await prisma.locationPing.create({
        data: {
          userId: buddyId,
          lat: clamp(lat + ox),
          lng: clamp(lng + oy),
          label: "Пара патруля",
        },
      });
    }
  }

  return NextResponse.json({ ping });
}
