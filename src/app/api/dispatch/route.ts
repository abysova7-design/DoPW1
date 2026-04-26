import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const where =
    user.isDispatcher || user.isAdmin
      ? { status: { in: ["OPEN", "ACCEPTED"] } }
      : {
          OR: [
            { targetId: null, status: { in: ["OPEN", "ACCEPTED"] } },
            { targetId: user.id },
          ],
        };

  const calls = await prisma.dispatchCall.findMany({
    where,
    include: {
      creator: { select: { nickname: true, displayName: true } },
      target: { select: { nickname: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({ calls });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  if (!user.isDispatcher && !user.isAdmin) {
    return NextResponse.json({ error: "Только диспетчеры" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const bodyText = String(body?.bodyText ?? "").trim();
  const targetId = typeof body?.targetId === "string" ? body.targetId : null;
  const lat = typeof body?.lat === "number" ? body.lat : null;
  const lng = typeof body?.lng === "number" ? body.lng : null;

  if (!title || !bodyText) {
    return NextResponse.json({ error: "Заголовок и текст обязательны" }, { status: 400 });
  }

  const call = await prisma.dispatchCall.create({
    data: {
      creatorId: user.id,
      targetId,
      title,
      body: bodyText,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    },
  });

  if (targetId) {
    await prisma.notification.create({
      data: {
        userId: targetId,
        type: "DISPATCH",
        title: `📡 Диспетчер: ${title}`,
        body: bodyText,
      },
    });
  }

  return NextResponse.json({ call });
}
