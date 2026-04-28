import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-server";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const vehicles = await prisma.vehicleRegistry.findMany({
    orderBy: { plate: "asc" },
  });
  return NextResponse.json({ vehicles });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const plate = String(body?.plate ?? "").trim().toUpperCase();
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  const owner = typeof body?.owner === "string" ? body.owner.trim().slice(0, 200) : "";
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!plate) return NextResponse.json({ error: "Номер обязателен" }, { status: 400 });

  const v = await prisma.vehicleRegistry.create({
    data: {
      plate,
      model: model || null,
      owner: owner || null,
      photoUrl: photoUrl || null,
      notes: notes || null,
    },
  });
  await prisma.vehicleRegistryAudit.create({
    data: {
      vehicleId: v.id,
      actorId: admin.id,
      action: "ADMIN_CREATE",
      reason: notes || null,
    },
  });
  return NextResponse.json({ vehicle: v });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Только админ" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен id" }, { status: 400 });

  await prisma.vehicleRegistry.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
