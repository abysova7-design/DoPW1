import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePlateInput } from "@/lib/plate-normalize";

const MAX_PHOTOS = 4;
const MAX_RESULTS = 6;

function parsePhotos(raw: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is string => typeof x === "string" && x.startsWith("data:image/"))
      .slice(0, MAX_PHOTOS);
  } catch {
    return [];
  }
}

/** Публичная справка по закрытым эвакуациям: без сотрудника и владельца. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const q = normalizePlateInput(raw);
  if (q.length < 4) {
    return NextResponse.json({ error: "Введите минимум 4 символа номера" }, { status: 400 });
  }
  if (q.length > 24) {
    return NextResponse.json({ error: "Номер слишком длинный" }, { status: 400 });
  }

  const closed = await prisma.evacuation.findMany({
    where: {
      status: "CLOSED",
      closedAt: { not: null },
    },
    orderBy: { closedAt: "desc" },
    take: 400,
    select: {
      id: true,
      plate: true,
      violation: true,
      closedAt: true,
      createdAt: true,
      photoUrls: true,
    },
  });

  const matches = closed
    .filter((e) => normalizePlateInput(e.plate) === q)
    .slice(0, MAX_RESULTS);

  const results = matches.map((e) => ({
    violation: e.violation,
    evacuatedAt: (e.closedAt ?? e.createdAt).toISOString(),
    photos: parsePhotos(e.photoUrls),
  }));

  return NextResponse.json({
    plateQuery: q,
    found: results.length,
    results,
    notice:
      "Показаны только завершённые эвакуации. ФИО сотрудника и владельца не публикуются.",
  });
}
