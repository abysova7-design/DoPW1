"use client";

import { useMemo } from "react";
import { useRadio } from "./RadioProvider";

export function RadioPanel() {
  const {
    me,
    participants,
    enabled,
    setEnabled,
    transmitting,
    setTransmitting,
    micError,
    connectedCount,
  } = useRadio();

  const talkingNow = useMemo(
    () =>
      participants
        .filter((p) => p.isTransmitting)
        .map((p) => p.user.displayName ?? p.user.nickname),
    [participants],
  );

  if (!me) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--dor-border)] bg-[var(--dor-night)]/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Рация PTT</div>
        <label className="flex items-center gap-2 text-xs text-[var(--dor-muted)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Вкл
        </label>
      </div>

      <div className="mt-2 text-xs text-[var(--dor-muted)]">
        Участники онлайн: {participants.length} · каналов: {connectedCount}
      </div>
      {talkingNow.length > 0 ? (
        <div className="mt-1 text-xs text-[var(--dor-orange)]">
          Говорит: {talkingNow.join(", ")}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!enabled}
        className={`mt-3 w-full rounded-xl px-3 py-3 text-sm font-semibold transition ${
          transmitting
            ? "bg-[var(--dor-orange)] text-black"
            : "bg-[var(--dor-surface)] text-[var(--dor-text)]"
        } ${!enabled ? "cursor-not-allowed opacity-50" : ""}`}
        onMouseDown={() => setTransmitting(true)}
        onMouseUp={() => setTransmitting(false)}
        onMouseLeave={() => setTransmitting(false)}
        onTouchStart={() => setTransmitting(true)}
        onTouchEnd={() => setTransmitting(false)}
      >
        {transmitting ? "Говорю..." : "Зажми и говори"}
      </button>

      <div className="mt-3 max-h-28 overflow-auto rounded-lg border border-[var(--dor-border)] p-2 text-xs">
        {participants.length === 0 ? (
          <div className="text-[var(--dor-muted)]">Никого в канале</div>
        ) : (
          participants.map((p) => (
            <div key={p.userId} className="flex items-center justify-between py-0.5">
              <span>{p.user.displayName ?? p.user.nickname}</span>
              <span className={p.isTransmitting ? "text-[var(--dor-orange)]" : "text-[var(--dor-muted)]"}>
                {p.isTransmitting ? "говорит" : "онлайн"}
              </span>
            </div>
          ))
        )}
      </div>
      {micError ? <div className="mt-2 text-xs text-red-400">{micError}</div> : null}
    </div>
  );
}
