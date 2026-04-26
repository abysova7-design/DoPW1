import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { stationaryCheckpointById } from "@/lib/road-patrol";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const checkpointId = typeof body?.checkpointId === "number" ? body.checkpointId : NaN;
  if (!Number.isInteger(checkpointId) || !stationaryCheckpointById(checkpointId)) {
    return NextResponse.json({ error: "Некорректный блок-пост" }, { status: 400 });
  }

  const duty = await prisma.patrolCheckpointDuty.upsert({
    where: { userId: user.id },
    create: { userId: user.id, checkpointId },
    update: { checkpointId, startedAt: new Date() },
  });

  return NextResponse.json({ duty });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  await prisma.patrolCheckpointDuty.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
