import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { addXp } from "@/lib/positions";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { isPatrolReportKind, ROAD_PATROL_XP_PER_ACTION } from "@/lib/road-patrol";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  if (user.isDispatcher || user.isAdmin) {
    const list = await prisma.roadPatrolReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        author: { select: { nickname: true, displayName: true } },
      },
    });
    return NextResponse.json({ reports: list });
  }

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

  const mine = await prisma.roadPatrolReport.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return NextResponse.json({ reports: mine });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const access = await roadPatrolAccessUserId(user.id);
  if (!access) {
    return NextResponse.json({ error: "Нет активной задачи «Дорожный патруль»" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "");
  if (!isPatrolReportKind(kind)) {
    return NextResponse.json({ error: "Некорректный тип отчёта" }, { status: 400 });
  }
  const note = String(body?.note ?? "").trim().slice(0, 2000);
  const lat = typeof body?.lat === "number" ? body.lat : undefined;
  const lng = typeof body?.lng === "number" ? body.lng : undefined;

  const report = await prisma.roadPatrolReport.create({
    data: {
      authorId: user.id,
      kind,
      note,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      status: "PENDING",
    },
  });

  const { xp, level } = addXp(user.xp, user.level, ROAD_PATROL_XP_PER_ACTION);
  await prisma.user.update({
    where: { id: user.id },
    data: { xp, level },
  });

  const dispatchers = await prisma.user.findMany({
    where: { OR: [{ isDispatcher: true }, { isAdmin: true }] },
    select: { id: true },
  });
  if (dispatchers.length > 0) {
    await prisma.notification.createMany({
      data: dispatchers.map((d) => ({
        userId: d.id,
        type: NotificationType.ROAD_PATROL_REPORT,
        title: "🛣️ Отчёт дорожного патруля",
        body: `${user.nickname}: ${kind}${note ? ` — ${note.slice(0, 120)}` : ""}`,
      })),
    });
  }

  return NextResponse.json({ report, xpGained: ROAD_PATROL_XP_PER_ACTION, xp, level });
}
