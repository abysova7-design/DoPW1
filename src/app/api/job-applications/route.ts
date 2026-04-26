import { NextResponse } from "next/server";
import { NotificationType, PositionRank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { canManageJobApplications } from "@/lib/positions";
import {
  insertJobApplicationInput,
  listJobApplicationsSql,
} from "@/lib/job-application-sql";

function parseBody(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function computeIncome(
  engineeringEdu: boolean,
  driverLicense: boolean,
): number {
  if (engineeringEdu) return 15_000;
  if (driverLicense) return 14_500;
  return 13_000;
}

/** Публичная подача заявки */
export async function POST(req: Request) {
  try {
    const body = parseBody(await req.text());
    const nickname = String(body.nickname ?? "").trim();
    const gameLevel = String(body.gameLevel ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const educationLevel = body.educationLevel
      ? String(body.educationLevel).trim()
      : null;
    const licenseCategory = body.licenseCategory
      ? String(body.licenseCategory).trim()
      : null;
    const drugAddict = Boolean(body.drugAddict);
    const engineeringEdu = Boolean(body.engineeringEdu);
    const driverLicense = Boolean(body.driverLicense);
    const interviewRaw = String(body.interviewAt ?? "").trim();

    if (!nickname || !gameLevel || !phone || !interviewRaw) {
      return NextResponse.json(
        { error: "Укажите ник, уровень, телефон и дату собеседования" },
        { status: 400 },
      );
    }

    const interviewAt = new Date(interviewRaw);
    if (Number.isNaN(interviewAt.getTime())) {
      return NextResponse.json(
        { error: "Некорректная дата / время собеседования" },
        { status: 400 },
      );
    }

    if (engineeringEdu && !educationLevel) {
      return NextResponse.json(
        { error: "Укажите уровень образования" },
        { status: 400 },
      );
    }
    if (driverLicense && !licenseCategory) {
      return NextResponse.json(
        { error: "Укажите категорию водительских прав" },
        { status: 400 },
      );
    }

    const expectedIncome = computeIncome(engineeringEdu, driverLicense);

    const id = await insertJobApplicationInput({
      nickname,
      gameLevel,
      drugAddict,
      phone,
      engineeringEdu,
      educationLevel: engineeringEdu ? educationLevel : null,
      driverLicense,
      licenseCategory: driverLicense ? licenseCategory : null,
      interviewAt,
      expectedIncome,
    });

    const preview = `Ник: ${nickname} · ${phone} · собеседование: ${interviewAt.toLocaleString("ru-RU")}`;

    const recipients = await prisma.user.findMany({
      where: {
        OR: [
          { positionRank: PositionRank.SUB_DIRECTOR },
          { positionRank: PositionRank.DIRECTOR },
          { isAdmin: true },
        ],
      },
      select: { id: true },
    });

    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          type: NotificationType.JOB_APPLICATION,
          title: "Новая заявка на собеседование",
          body: preview,
        })),
      });
    }

    return NextResponse.json({ id, ok: true });
  } catch (e) {
    console.error("job-applications POST", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Серверная ошибка" },
      { status: 500 },
    );
  }
}

/** Список заявок — зам. директора, директор, админ */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }
  if (!canManageJobApplications(user.positionRank, user.isAdmin)) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }

  const applications = await listJobApplicationsSql();
  return NextResponse.json({ applications });
}
