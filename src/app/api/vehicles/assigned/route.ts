import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { canExamine } from "@/lib/positions";

const MAX_PER_USER = 3;

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId") ?? user.id;

  // ALL — только для админа, возвращает все назначения
  if (targetId === "ALL") {
    if (!user.isAdmin) return NextResponse.json({ error: "Нет прав" }, { status: 403 });
    const vehicles = await prisma.vehicleAssignment.findMany({
      orderBy: { assignedAt: "desc" },
      include: { user: { select: { nickname: true } } },
    });
    return NextResponse.json({ vehicles });
  }

  if (targetId !== user.id && !canExamine(user.positionRank) && !user.isAdmin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const vehicles = await prisma.vehicleAssignment.findMany({
    where: { userId: targetId },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json({ vehicles });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!canExamine(user.positionRank) && !user.isAdmin) {
    return NextResponse.json(
      { error: "Закрепить машину может только Chief Specialist и выше" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const targetId = String(body?.userId ?? user.id);
  const cid = String(body?.cid ?? "").trim();
  const vehicleName = String(body?.vehicleName ?? "").trim();
  const photoUrl =
    typeof body?.photoUrl === "string" ? body.photoUrl.trim() : null;

  if (!cid || !vehicleName) {
    return NextResponse.json(
      { error: "CID и название машины обязательны" },
      { status: 400 },
    );
  }

  const existing = await prisma.vehicleAssignment.count({
    where: { userId: targetId },
  });
  if (existing >= MAX_PER_USER) {
    return NextResponse.json(
      { error: `Максимум ${MAX_PER_USER} машины на сотрудника` },
      { status: 400 },
    );
  }

  const v = await prisma.vehicleAssignment.create({
    data: {
      userId: targetId,
      cid,
      vehicleName,
      photoUrl: photoUrl || null,
    },
  });

  return NextResponse.json({ vehicle: v });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!canExamine(user.positionRank) && !user.isAdmin) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен id" }, { status: 400 });

  await prisma.vehicleAssignment
    .delete({ where: { id } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
