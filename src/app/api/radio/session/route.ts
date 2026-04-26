import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

const ROOM_DEFAULT = "dispatch-main";
const ONLINE_MS = 25_000;

function activeSince() {
  return new Date(Date.now() - ONLINE_MS);
}

function getRoom(url: string) {
  const sp = new URL(url).searchParams;
  return (sp.get("room") ?? ROOM_DEFAULT).trim() || ROOM_DEFAULT;
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const room = getRoom(req.url);
  await prisma.radioSession.deleteMany({
    where: { room, lastHeartbeat: { lt: activeSince() } },
  });
  const sessions = await prisma.radioSession.findMany({
    where: { room, lastHeartbeat: { gte: activeSince() } },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          displayName: true,
          isDispatcher: true,
          isAdmin: true,
        },
      },
    },
    orderBy: [{ isTransmitting: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    room,
    participants: sessions.map((s) => ({
      userId: s.userId,
      isTransmitting: s.isTransmitting,
      lastHeartbeat: s.lastHeartbeat,
      user: s.user,
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const room =
    (typeof body?.room === "string" ? body.room : ROOM_DEFAULT).trim() || ROOM_DEFAULT;

  await prisma.radioSession.upsert({
    where: { userId_room: { userId: user.id, room } },
    update: { lastHeartbeat: new Date() },
    create: {
      userId: user.id,
      room,
      lastHeartbeat: new Date(),
      isTransmitting: false,
    },
  });

  return NextResponse.json({ ok: true, room });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const room =
    (typeof body?.room === "string" ? body.room : ROOM_DEFAULT).trim() || ROOM_DEFAULT;

  const data: { lastHeartbeat: Date; isTransmitting?: boolean } = {
    lastHeartbeat: new Date(),
  };
  if (typeof body?.isTransmitting === "boolean") {
    data.isTransmitting = body.isTransmitting;
  }

  await prisma.radioSession.upsert({
    where: { userId_room: { userId: user.id, room } },
    update: data,
    create: {
      userId: user.id,
      room,
      isTransmitting: Boolean(body?.isTransmitting),
      lastHeartbeat: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const room = getRoom(req.url);
  await prisma.radioSession.deleteMany({ where: { userId: user.id, room } });
  return NextResponse.json({ ok: true });
}
