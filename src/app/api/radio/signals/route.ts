import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const ROOM_DEFAULT = "dispatch-main";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const room = (sp.get("room") ?? ROOM_DEFAULT).trim() || ROOM_DEFAULT;
  await prisma.radioSignal.deleteMany({
    where: { room, createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
  });
  const after = Number(sp.get("afterMs") ?? "0");
  const afterDate = Number.isFinite(after) && after > 0 ? new Date(after) : new Date(0);

  const signals = await prisma.radioSignal.findMany({
    where: {
      room,
      createdAt: { gt: afterDate },
      OR: [{ toUserId: null }, { toUserId: user.id }],
    },
    orderBy: { createdAt: "asc" },
    take: 150,
  });

  return NextResponse.json({ signals });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const room =
    (typeof body?.room === "string" ? body.room : ROOM_DEFAULT).trim() || ROOM_DEFAULT;
  const type = String(body?.type ?? "").trim();
  const payload = JSON.stringify(body?.payload ?? {});
  const toUserId =
    typeof body?.toUserId === "string" && body.toUserId.trim()
      ? body.toUserId.trim()
      : null;

  if (!type) return NextResponse.json({ error: "Нужен type" }, { status: 400 });

  const signal = await prisma.radioSignal.create({
    data: {
      room,
      type,
      payload,
      fromUserId: user.id,
      toUserId,
    },
  });
  return NextResponse.json({ signal });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((x: unknown) => typeof x === "string")
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true });

  await prisma.radioSignal.updateMany({
    where: {
      id: { in: ids },
      OR: [{ toUserId: null }, { toUserId: user.id }],
      consumedAt: null,
    },
    data: { consumedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
