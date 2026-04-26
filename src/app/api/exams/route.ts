import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { canExamine } from "@/lib/positions";

const EXAM_KINDS = ["TOW_TRUCK", "DRIVER"] as const;

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  if (canExamine(user.positionRank) || user.isAdmin) {
    const exams = await prisma.examRegistration.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      include: {
        user: { select: { id: true, nickname: true, displayName: true, positionRank: true } },
        examiner: { select: { id: true, nickname: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ exams, role: "examiner" });
  }

  const myExams = await prisma.examRegistration.findMany({
    where: { userId: user.id },
    include: {
      examiner: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ exams: myExams, role: "student" });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as string;

  if (!EXAM_KINDS.includes(kind as (typeof EXAM_KINDS)[number])) {
    return NextResponse.json({ error: "Неверный тип экзамена" }, { status: 400 });
  }

  const testScore = typeof body?.testScore === "number" ? body.testScore : null;
  if (testScore === null || testScore < 4) {
    return NextResponse.json(
      { error: "Необходимо пройти тест (не менее 4/5) перед записью на экзамен" },
      { status: 400 },
    );
  }

  const existing = await prisma.examRegistration.findFirst({
    where: { userId: user.id, kind, status: { in: ["PENDING", "IN_PROGRESS"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "Вы уже записаны на этот экзамен" }, { status: 400 });
  }

  const exam = await prisma.examRegistration.create({
    data: { userId: user.id, kind, testScore },
  });

  return NextResponse.json({ exam });
}
