"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { RANK_LABELS, canExamine, type PositionRank } from "@/lib/positions";
import { playSound } from "@/lib/sounds";

const KIND_LABEL: Record<string, string> = {
  TOW_TRUCK: "Допуск на эвакуатор",
  DRIVER: "Допуск водителя",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ожидает",
  IN_PROGRESS: "На экзамене",
  PASSED: "Сдан ✅",
  FAILED: "Не сдан ❌",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-[var(--dor-muted)]",
  IN_PROGRESS: "text-[var(--dor-orange)]",
  PASSED: "text-[var(--dor-green-bright)]",
  FAILED: "text-red-400",
};

type ExamRow = {
  id: string;
  kind: string;
  status: string;
  testScore: number | null;
  examNote: string | null;
  createdAt: string;
  finishedAt: string | null;
  user?: { id: string; nickname: string; displayName: string | null; positionRank: PositionRank };
  examiner?: { id: string; nickname: string } | null;
};

export default function ExamsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    id: string;
    isAdmin: boolean;
    positionRank: PositionRank;
    nickname: string;
  } | null>(null);
  const [role, setRole] = useState<"student" | "examiner">("student");
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const prevPendingIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    if (!d.user) { router.replace("/login"); return; }
    setMe(d.user);

    const e = await fetch("/api/exams");
    const ed = await e.json();
    const newRole: "student" | "examiner" = ed.role ?? "student";
    setRole(newRole);
    const newExams: ExamRow[] = ed.exams ?? [];
    setExams(newExams);

    // Звук ekz.mp3 для экзаменатора при появлении новых заявок
    if (newRole === "examiner") {
      const newPending = newExams.filter((ex) => ex.status === "PENDING");
      const truly_new = newPending.filter((ex) => !prevPendingIds.current.has(ex.id));
      if (truly_new.length > 0) {
        // Только если уже была инициализация (не первая загрузка)
        if (prevPendingIds.current.size > 0 || newPending.length === 0) {
          playSound("exam");
        }
        truly_new.forEach((ex) => prevPendingIds.current.add(ex.id));
      }
      // Обновляем множество
      newPending.forEach((ex) => prevPendingIds.current.add(ex.id));
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Периодическая проверка для экзаменаторов
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function action(id: string, act: "start" | "pass" | "fail") {
    setBusy(true);
    const note = noteMap[id] ?? "";
    await fetch(`/api/exams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act, note }),
    });
    setBusy(false);
    load();
  }

  if (!me) {
    return <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">Загрузка…</div>;
  }

  const isExaminer = canExamine(me.positionRank) || me.isAdmin;

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">🎓 Экзамены и допуски</h1>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              {isExaminer
                ? "Очередь кандидатов на экзамен (Chief Specialist и выше)"
                : "Ваши записи на экзамен"}
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">← Кабинет</Link>
        </div>

        {!isExaminer && (
          <section className="dor-card p-5">
            <h2 className="font-semibold">Получить допуск</h2>
            <p className="mt-2 text-sm text-[var(--dor-muted)]">
              Изучите правила → пройдите тест → запишитесь на экзамен.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard/knowledge/evacuation" className="dor-btn-secondary text-sm">
                📖 Правила эвакуатора + тест
              </Link>
              <Link href="/dashboard/knowledge/driver" className="dor-btn-secondary text-sm">
                📖 Правила водителя + тест
              </Link>
            </div>
          </section>
        )}

        <section className="dor-card p-5">
          <h2 className="font-semibold">
            {isExaminer ? "Очередь на экзамен" : "Мои записи"}
          </h2>
          {exams.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--dor-muted)]">
              {isExaminer ? "Нет кандидатов в очереди." : "Вы не записаны ни на один экзамен."}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {exams.map((ex) => (
                <div
                  key={ex.id}
                  className="rounded-2xl border border-[var(--dor-border)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      {isExaminer && ex.user ? (
                        <div className="font-medium">
                          {ex.user.displayName ?? ex.user.nickname}
                          <span className="ml-2 text-xs text-[var(--dor-muted)]">
                            {RANK_LABELS[ex.user.positionRank]}
                          </span>
                        </div>
                      ) : null}
                      <div className="text-sm text-[var(--dor-muted)]">
                        {KIND_LABEL[ex.kind] ?? ex.kind}
                      </div>
                      <div className="mt-1 text-xs text-[var(--dor-muted)]">
                        Тест: {ex.testScore ?? "—"}/5 · Записан:{" "}
                        {new Date(ex.createdAt).toLocaleString("ru-RU")}
                        {ex.finishedAt
                          ? ` · Завершён: ${new Date(ex.finishedAt).toLocaleString("ru-RU")}`
                          : ""}
                      </div>
                      {ex.examNote ? (
                        <div className="mt-1 text-xs text-[var(--dor-muted)]">
                          Примечание: {ex.examNote}
                        </div>
                      ) : null}
                      {ex.examiner ? (
                        <div className="text-xs text-[var(--dor-muted)]">
                          Экзаменатор: {ex.examiner.nickname}
                        </div>
                      ) : null}
                    </div>
                    <span className={`text-sm font-semibold ${STATUS_COLOR[ex.status] ?? ""}`}>
                      {STATUS_LABEL[ex.status] ?? ex.status}
                    </span>
                  </div>

                  {isExaminer && (ex.status === "PENDING" || ex.status === "IN_PROGRESS") ? (
                    <div className="mt-3 space-y-2">
                      {ex.status === "IN_PROGRESS" ? (
                        <>
                          <textarea
                            className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                            rows={2}
                            placeholder="Примечание экзаменатора (результаты, замечания…)"
                            value={noteMap[ex.id] ?? ""}
                            onChange={(e) =>
                              setNoteMap((prev) => ({ ...prev, [ex.id]: e.target.value }))
                            }
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              className="dor-btn-primary text-sm"
                              onClick={() => action(ex.id, "pass")}
                            >
                              ✅ Сдал
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              className="dor-btn-secondary text-sm"
                              onClick={() => action(ex.id, "fail")}
                            >
                              ❌ Не сдал
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          className="dor-btn-primary text-sm"
                          onClick={() => action(ex.id, "start")}
                        >
                          Начать экзамен
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
