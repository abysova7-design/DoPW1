"use client";

import { useEffect, useState } from "react";

const ITEMS = [
  { id: "form",      text: "Получил на складе жилет и каску" },
  { id: "clist",     text: "Включил клист /clist 10" },
  { id: "vehicle",   text: "Осмотрел закреплённый транспорт (повреждения, топливо)" },
  { id: "radio",     text: "Объявил в /rr [cID] Машина проверена, готова к работе" },
  { id: "certs",     text: "Проверил наличие нужных допусков для задач смены" },
  { id: "regs",      text: "Ознакомлен с регламентом эвакуации и раций" },
];

export function PreShiftChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [date] = useState(() => new Date().toDateString());

  useEffect(() => {
    const saved = localStorage.getItem(`checklist_${date}`);
    if (saved) setChecked(JSON.parse(saved) as Record<string, boolean>);
  }, [date]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`checklist_${date}`, JSON.stringify(next));
      return next;
    });
  }

  const done = ITEMS.filter((i) => checked[i.id]).length;
  const all = ITEMS.length;
  const pct = Math.round((done / all) * 100);
  const ready = done === all;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--dor-muted)]">
          {done}/{all} выполнено
        </span>
        {ready && (
          <span className="rounded-lg bg-[var(--dor-green)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--dor-green-bright)]">
            ✅ Готов к выезду
          </span>
        )}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dor-surface)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--dor-green)] to-[var(--dor-orange)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--dor-border)] px-3 py-2 transition hover:bg-[var(--dor-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--dor-orange)]"
                checked={!!checked[item.id]}
                onChange={() => toggle(item.id)}
              />
              <span
                className={`text-sm ${
                  checked[item.id]
                    ? "text-[var(--dor-muted)] line-through"
                    : "text-[var(--dor-text)]"
                }`}
              >
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
