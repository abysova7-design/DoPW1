"use client";

import { useState } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";

type LookupRow = {
  violation: string;
  evacuatedAt: string;
  photos: string[];
};

export function PublicEvacuationLookup() {
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<LookupRow[] | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = plate.trim();
    if (q.length < 4) {
      setMsg("Введите минимум 4 символа госномера.");
      setRows(null);
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/public/evacuation-lookup?q=${encodeURIComponent(q)}`);
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMsg(d.error ?? "Запрос не выполнен");
      setRows(null);
      return;
    }
    setRows(d.results ?? []);
    if ((d.results ?? []).length === 0) {
      setMsg("Закрытых эвакуаций с таким номером в базе не найдено.");
    } else {
      setMsg(null);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-[var(--dor-muted)]">Госномер (латиница, как на ТС)</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-4 py-3 font-mono text-sm outline-none transition focus:border-[var(--dor-orange)]"
            placeholder="Например: ABC1234"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            maxLength={24}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="dor-btn-primary shrink-0 px-6 py-3 text-sm disabled:opacity-50"
        >
          {busy ? "Поиск…" : "Проверить"}
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-[var(--dor-muted)]">
        В ответе только нарушение, дата и время завершённой эвакуации и фотоматериалы из дела. Данные о
        сотруднике и владельце ТС не передаются.
      </p>

      {msg ? <p className="mt-4 text-sm text-[var(--dor-orange)]">{msg}</p> : null}

      {rows && rows.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {rows.map((row, i) => (
            <li
              key={`${row.evacuatedAt}-${i}`}
              className="rounded-2xl border border-[var(--dor-border)] bg-[var(--dor-night)]/90 p-4 shadow-sm"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--dor-muted)]">
                Завершённая эвакуация
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--dor-text)]">{row.violation}</p>
              <p className="mt-1 font-mono text-xs text-[var(--dor-muted)]">
                {new Date(row.evacuatedAt).toLocaleString("ru-RU", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              {row.photos.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.photos.map((url, j) => (
                    <button
                      key={j}
                      type="button"
                      className="overflow-hidden rounded-lg border border-[var(--dor-border)] focus:outline-none focus:ring-2 focus:ring-[var(--dor-orange)]"
                      onClick={() => setLightbox({ photos: row.photos, idx: j })}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-20 w-28 object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--dor-muted)]">Фото в карточке не приложены.</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {lightbox ? (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
