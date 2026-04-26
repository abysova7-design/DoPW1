import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-server";
import { canExamine, RANK_LABELS } from "@/lib/positions";
import { postAttestation } from "@/lib/channels";

const KIND_LABELS: Record<string, string> = {
  TOW_TRUCK: "эвакуатора",
  DRIVER: "водителя",
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const { id } = await ctx.params;
  const exam = await prisma.examRegistration.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!exam) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "start") {
    if (!canExamine(user.positionRank) && !user.isAdmin) {
      return NextResponse.json(
        { error: "Только Chief Specialist и выше" },
        { status: 403 },
      );
    }
    if (exam.status !== "PENDING") {
      return NextResponse.json({ error: "Экзамен уже начат или завершён" }, { status: 400 });
    }
    const updated = await prisma.examRegistration.update({
      where: { id },
      data: { status: "IN_PROGRESS", examinerId: user.id },
    });
    return NextResponse.json({ exam: updated });
  }

  if (action === "pass" || action === "fail") {
    if (!canExamine(user.positionRank) && !user.isAdmin) {
      return NextResponse.json(
        { error: "Только Chief Specialist и выше" },
        { status: 403 },
      );
    }
    if (exam.examinerId !== user.id && !user.isAdmin) {
      return NextResponse.json(
        { error: "Экзамен ведёт другой экзаменатор" },
        { status: 403 },
      );
    }
    if (exam.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Экзамен не в процессе" }, { status: 400 });
    }

    const passed = action === "pass";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    const updated = await prisma.examRegistration.update({
      where: { id },
      data: {
        status: passed ? "PASSED" : "FAILED",
        examNote: note || null,
        finishedAt: new Date(),
      },
    });

    if (passed) {
      if (exam.kind === "TOW_TRUCK") {
        await prisma.user.update({
          where: { id: exam.userId },
          data: { towTruckCert: true },
        });
      } else if (exam.kind === "DRIVER") {
        await prisma.user.update({
          where: { id: exam.userId },
          data: { driverCert: true },
        });
      }

      await prisma.notification.create({
        data: {
          userId: exam.userId,
          type: "SYSTEM",
          title: `🎓 Допуск получен — ${KIND_LABELS[exam.kind] ?? exam.kind}`,
          body: `Экзаменатор ${user.nickname} выдал вам допуск.${note ? ` Примечание: ${note}` : ""}`,
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: exam.userId,
          type: "SYSTEM",
          title: `❌ Экзамен не сдан — ${KIND_LABELS[exam.kind] ?? exam.kind}`,
          body: `Экзаменатор ${user.nickname}.${note ? ` Примечание: ${note}` : ""} Вы можете пересдать после повторного изучения материала.`,
        },
      });
    }

    const rankLabel = RANK_LABELS[user.positionRank] ?? user.positionRank;
    await postAttestation(
      `${passed ? "✅ СДАН" : "❌ НЕ СДАН"} — ${exam.user.nickname} (${KIND_LABELS[exam.kind] ?? exam.kind})`,
      `Кандидат: ${exam.user.nickname} (${exam.user.displayName ?? "—"})
Тип экзамена: ${exam.kind === "TOW_TRUCK" ? "Допуск на эвакуатор" : "Допуск водителя"}
Результат теста: ${exam.testScore ?? "—"}/5
Экзаменатор: ${user.nickname} · ${rankLabel}
${note ? `Примечание: ${note}` : ""}`,
      passed,
      user.id,
    );

    return NextResponse.json({ exam: updated });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
