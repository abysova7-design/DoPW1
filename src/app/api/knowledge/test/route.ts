import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-server";
import { QUESTIONS, PASS_SCORE } from "@/lib/questions";

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "");
  const answers = body?.answers as Record<string, number> | undefined;

  const questions = QUESTIONS[kind];
  if (!questions) {
    return NextResponse.json({ error: "Неверный тип теста" }, { status: 400 });
  }
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Нужны ответы" }, { status: 400 });
  }

  let score = 0;
  const details = questions.map((q) => {
    const chosen = answers[q.id] ?? -1;
    const correct = chosen === q.correct;
    if (correct) score++;
    return { id: q.id, correct, chosen, rightAnswer: q.correct };
  });

  const passed = score >= PASS_SCORE;

  return NextResponse.json({ score, total: questions.length, passed, details });
}
