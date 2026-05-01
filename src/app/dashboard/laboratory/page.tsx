"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { playSound } from "@/lib/sounds";
import type { PositionRank } from "@/lib/positions";

type Mode = "spectrum" | "titration" | "qc";

function randSeed() {
  return Math.floor(Math.random() * 1e9);
}

/** Спектр: подгонка «линий» к эталону (как упрощённый спектрофотометр). */
function SpectrumGame({ onDone }: { onDone: (ok: boolean) => void }) {
  const target = useMemo(
    () => [0.2, 0.5, 0.8, 0.4, 0.6].map((v) => Math.min(1, Math.max(0.05, v + (Math.random() - 0.5) * 0.25))),
    [],
  );
  const [bars, setBars] = useState([0.5, 0.5, 0.5, 0.5, 0.5]);
  const err = useMemo(
    () => bars.reduce((s, b, i) => s + Math.abs(b - target[i]), 0),
    [bars, target],
  );
  const ok = err < 0.35;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dor-muted)]">
        Подстройте пять каналов излучения под «эталонный» профиль неизвестной пробы. Чем ближе совпадение, тем
        выше доверие к анализу.
      </p>
      <div className="flex gap-2 rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] p-3">
        {target.map((t, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[40px] rounded-t bg-emerald-500/40"
              style={{ height: `${t * 120}px` }}
              title="эталон"
            />
            <span className="text-[9px] text-[var(--dor-muted)]">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {bars.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-16 text-xs text-[var(--dor-muted)]">Канал {i + 1}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(b * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setBars((prev) => prev.map((x, j) => (j === i ? v : x)));
              }}
              className="flex-1 accent-[var(--dor-orange)]"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--dor-muted)]">
        Отклонение: <strong className="text-[var(--dor-text)]">{err.toFixed(2)}</strong> · цель &lt; 0.35
      </p>
      <button type="button" className="dor-btn-primary text-sm" onClick={() => onDone(ok)}>
        Зафиксировать спектр
      </button>
    </div>
  );
}

/** Титрование: довести pH до нейтральной зоны каплями. */
function TitrationGame({ onDone }: { onDone: (ok: boolean) => void }) {
  const [ph, setPh] = useState(3.2);
  const [drops, setDrops] = useState(0);
  const maxDrops = 14;
  const addDrop = () => {
    if (drops >= maxDrops) return;
    setDrops((d) => d + 1);
    setPh((p) => Math.min(10.5, p + 0.35 + Math.random() * 0.15));
  };
  const inZone = ph >= 6.8 && ph <= 7.4;
  const submit = () => onDone(inZone && drops > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dor-muted)]">
        Добавляйте реагент капля за каплей, пока индикатор не войдёт в нейтральную зону (как при титровании
        строительной воды).
      </p>
      <div className="rounded-xl border border-[var(--dor-border)] bg-[var(--dor-surface)]/40 p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xs text-[var(--dor-muted)]">Текущий pH</div>
            <div className="text-3xl font-mono font-bold text-[var(--dor-orange)]">{ph.toFixed(2)}</div>
          </div>
          <div className="text-right text-xs text-[var(--dor-muted)]">
            Капель: {drops}/{maxDrops}
            <br />
            Цель: 6.8–7.4
          </div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[var(--dor-border)]">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((ph - 3) / (10.5 - 3)) * 100}%`,
              background: inZone
                ? "linear-gradient(90deg,#22c55e,#4ade80)"
                : "linear-gradient(90deg,#e85d04,#fbbf24)",
            }}
          />
        </div>
      </div>
      <button type="button" className="dor-btn-secondary text-sm" onClick={addDrop} disabled={drops >= maxDrops}>
        Капнуть реагент
      </button>
      <button type="button" className="dor-btn-primary text-sm" onClick={submit}>
        Снять показания
      </button>
    </div>
  );
}

/** Контроль качества: найти аномалию на «поле» пробы. */
function QcGame({ seed, onDone }: { seed: number; onDone: (ok: boolean) => void }) {
  const badIdx = useMemo(() => seed % 9, [seed]);
  const [found, setFound] = useState<number | null>(null);
  const [t0] = useState(() => Date.now());

  const pick = (i: number) => {
    if (found != null) return;
    setFound(i);
    const fast = Date.now() - t0 < 12000;
    onDone(i === badIdx && fast);
    if (i === badIdx) playSound("notification");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--dor-muted)]">
        На сетке образцов один фрагмент с микротрещиной. Нажмите на подозрительную ячейку как можно быстрее (до
        12 с).
      </p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pick(i)}
            disabled={found != null}
            className={`aspect-square rounded-xl border text-sm font-medium transition ${
              found === i
                ? i === badIdx
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-red-500/60 bg-red-500/10 text-red-300"
                : "border-[var(--dor-border)] bg-[var(--dor-night)] hover:border-[var(--dor-orange)]/50"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {found != null ? (
        <p className="text-xs text-[var(--dor-muted)]">
          {found === badIdx ? "Дефект локализован — проба отправлена в отчёт." : "Ложная тревога — перезапустите режим."}
        </p>
      ) : null}
    </div>
  );
}

export default function LaboratoryPage() {
  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [mode, setMode] = useState<Mode>("spectrum");
  const [seed, setSeed] = useState(randSeed);
  const [log, setLog] = useState<string[]>([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setMe({ isAdmin: d.user.isAdmin, positionRank: d.user.positionRank });
      });
  }, []);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 8));
  }, []);

  const onMiniDone = (m: Mode, ok: boolean) => {
    if (ok) {
      setScore((s) => s + 1);
      playSound("notification");
      pushLog(`${m === "spectrum" ? "Спектр" : m === "titration" ? "Титрование" : "ОТК"}: анализ принят ✓`);
    } else {
      pushLog(
        `${m === "spectrum" ? "Спектр" : m === "titration" ? "Титрование" : "ОТК"}: нужна повторная попытка`,
      );
    }
    setSeed(randSeed());
  };

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed positionRank={me?.positionRank ?? null} isAdmin={me?.isAdmin} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Лаборатория DOPW</h1>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              Интерактивный блок для задачи «Забор проб»: три типа проверки — как в учебных симуляторах
              качественного анализа и виртуальных лабораторий.
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm shrink-0">
            Кабинет
          </Link>
        </div>

        <div className="dor-card border border-violet-500/25 bg-gradient-to-br from-violet-950/30 to-[var(--dor-night)] p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["spectrum", "Спектр пробы"],
                ["titration", "Титрование"],
                ["qc", "ОТК сетка"],
              ] as [Mode, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                  mode === k
                    ? "bg-violet-500 text-white"
                    : "bg-[var(--dor-surface)] text-[var(--dor-muted)] hover:text-[var(--dor-text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--dor-muted)]">
            Пройдено условных анализов: <strong className="text-[var(--dor-text)]">{score}</strong>
          </div>
        </div>

        <section className="dor-card p-5">
          {mode === "spectrum" ? (
            <SpectrumGame key={seed} onDone={(ok) => onMiniDone("spectrum", ok)} />
          ) : mode === "titration" ? (
            <TitrationGame key={seed} onDone={(ok) => onMiniDone("titration", ok)} />
          ) : (
            <QcGame key={seed} seed={seed} onDone={(ok) => onMiniDone("qc", ok)} />
          )}
          <button
            type="button"
            className="mt-4 text-xs text-violet-300 underline decoration-dotted"
            onClick={() => setSeed(randSeed())}
          >
            Новая виртуальная проба
          </button>
        </section>

        {log.length > 0 ? (
          <section className="dor-card p-4">
            <h2 className="text-sm font-semibold text-[var(--dor-muted)]">Журнал сессии</h2>
            <ul className="mt-2 space-y-1 font-mono text-xs text-[var(--dor-text)]">
              {log.map((l, i) => (
                <li key={i}>— {l}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
