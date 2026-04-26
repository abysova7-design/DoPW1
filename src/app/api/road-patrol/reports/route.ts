import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { addXp } from "@/lib/positions";
import { roadPatrolAccessUserId } from "@/lib/road-patrol-access";
import { isPatrolReportKind, ROAD_PATROL_XP_PER_ACTION } from "@/lib/road-patrol";

const MAX_PHOTOS = 5;
const MAX_DATA_URL_LEN = 850_000;

function parsePhotoUrls(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    const s = item.trim();
    if (!s.startsWith("data:image/")) return null;
    if (s.length > MAX_DATA_URL_LEN) return null;
    out.push(s);
    if (out.length > MAX_PHOTOS) return null;
  }
  return out;
}

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

  const description = String(body?.description ?? "").trim().slice(0, 2000);
  if (!description) {
    return NextResponse.json({ error: "Опишите, что сделали (RP)" }, { status: 400 });
  }

  const lat = typeof body?.lat === "number" ? body.lat : NaN;
  const lng = typeof body?.lng === "number" ? body.lng : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "Укажите точку на карте: кнопка «Точка для отчёта», затем клик по карте" },
      { status: 400 },
    );
  }

  const citizenNicknameRaw = typeof body?.citizenNickname === "string" ? body.citizenNickname.trim() : "";
  const citizenNickname = citizenNicknameRaw ? citizenNicknameRaw.slice(0, 120) : null;

  const photos = parsePhotoUrls(body?.photoUrls);
  if (photos === null) {
    return NextResponse.json({ error: "Некорректные вложения фото" }, { status: 400 });
  }

  let note = description;
  if (kind === "BLOCKPOST_TEMP") {
    const tcpLat = typeof body?.tempCheckpoint?.lat === "number" ? body.tempCheckpoint.lat : NaN;
    const tcpLng = typeof body?.tempCheckpoint?.lng === "number" ? body.tempCheckpoint.lng : NaN;
    if (Number.isFinite(tcpLat) && Number.isFinite(tcpLng)) {
      note += `\n\nВременный КП (метка на карте): ${Math.round(tcpLat)}, ${Math.round(tcpLng)}`;
    }
  }

  const report = await prisma.roadPatrolReport.create({
    data: {
      authorId: user.id,
      kind,
      note,
      citizenNickname,
      photoUrls: JSON.stringify(photos),
      lat,
      lng,
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
        body: `${user.nickname}: ${kind}${description ? ` — ${description.slice(0, 120)}` : ""}`,
      })),
    });
  }

  return NextResponse.json({ report, xpGained: ROAD_PATROL_XP_PER_ACTION, xp, level });
}
