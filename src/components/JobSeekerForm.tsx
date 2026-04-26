"use client";

import { useMemo, useState } from "react";
import { safeJson } from "@/lib/safe-fetch";

function incomeLabel(engineeringEdu: boolean, driverLicense: boolean): number {
  if (engineeringEdu) return 15_000;
  if (driverLicense) return 14_500;
  return 13_000;
}

const LICENSE_CATS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "BE",
  "C1",
  "CE",
  "DE",
  "Прочее (укажу в чате)",
] as const;

export function JobSeekerForm() {
  const [nickname, setNickname] = useState("");
  const [gameLevel, setGameLevel] = useState("");
  const [drugAddict, setDrugAddict] = useState<"no" | "yes">("no");
  const [phone, setPhone] = useState("");
  const [engineeringEdu, setEngineeringEdu] = useState(false);
  const [educationLevel, setEducationLevel] = useState("");
  const [driverLicense, setDriverLicense] = useState(false);
  const [licenseCategory, setLicenseCategory] = useState("");
  const [interviewAt, setInterviewAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const income = useMemo(
    () => incomeLabel(engineeringEdu, driverLicense),
    [engineeringEdu, driverLicense],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/job-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          gameLevel,
          drugAddict: drugAddict === "yes",
          phone,
          engineeringEdu,
          educationLevel: engineeringEdu ? educationLevel : null,
          driverLicense,
          licenseCategory: driverLicense ? licenseCategory : null,
          interviewAt: interviewAt ? new Date(interviewAt).toISOString() : "",
        }),
      });
      const d = await safeJson<{ error?: string }>(r, {});
      if (!r.ok) {
        setErr(d.error ?? "Не удалось отправить");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--dor-green)]/40 bg-[var(--dor-green)]/10 p-8 text-center">
        <p className="text-lg font-semibold text-[var(--dor-text)]">Спасибо за заявку!</p>
        <p className="mt-2 text-sm text-[var(--dor-muted)]">
          Мы с вами свяжемся в ближайшее время.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 grid w-full max-w-none grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <div className="rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)]/60 p-4 md:col-span-2 lg:col-span-3">
        <p className="text-xs uppercase tracking-wider text-[var(--dor-muted)]">
          Ориентировочный доход (зависит от квалификации)
        </p>
        <p className="mt-1 text-2xl font-bold text-[var(--dor-orange)]">
          ${income.toLocaleString("ru-RU")} <span className="text-sm font-normal text-[var(--dor-muted)]">/ мес</span>
        </p>
        <p className="mt-2 text-xs text-[var(--dor-muted)]">
          Инженерное образование — 15 000$ · без инженерного, с правами — 14 500$ · без
          инженерного и без прав — 13 000$
        </p>
      </div>

      <div>
        <label className="text-xs text-[var(--dor-muted)]">Ваш никнейм (IC)</label>
        <input
          required
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-[var(--dor-muted)]">Ваш игровой уровень</label>
        <input
          required
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
          value={gameLevel}
          onChange={(e) => setGameLevel(e.target.value)}
          placeholder="напр. 12"
        />
      </div>

      <div>
        <label className="text-xs text-[var(--dor-muted)]">Наркозависимость (IC)</label>
        <div className="mt-1 flex gap-2">
          {(["no", "yes"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setDrugAddict(v)}
              className={`flex-1 rounded-xl py-2 text-sm ${
                drugAddict === v
                  ? "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)] ring-1 ring-[var(--dor-orange)]/50"
                  : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
              }`}
            >
              {v === "no" ? "Нет" : "Да"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-[var(--dor-muted)]">Номер телефона (IC / OOC)</label>
        <input
          required
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="прямой ввод"
        />
      </div>

      <div className="md:col-span-2 lg:col-span-3">
        <label className="text-xs text-[var(--dor-muted)]">Инженерное образование</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setEngineeringEdu(true)}
            className={`flex-1 rounded-xl py-2 text-sm ${
              engineeringEdu
                ? "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)] ring-1 ring-[var(--dor-orange)]/50"
                : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
            }`}
          >
            Да
          </button>
          <button
            type="button"
            onClick={() => setEngineeringEdu(false)}
            className={`flex-1 rounded-xl py-2 text-sm ${
              !engineeringEdu
                ? "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)] ring-1 ring-[var(--dor-orange)]/50"
                : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
            }`}
          >
            Нет
          </button>
        </div>
      </div>

      {engineeringEdu && (
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-[var(--dor-muted)]">Уровень / профиль образования</label>
          <input
            required={engineeringEdu}
            className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
            placeholder="Напр.: высшее, строительный инженер"
          />
        </div>
      )}

      <div className="md:col-span-2 lg:col-span-3">
        <label className="text-xs text-[var(--dor-muted)]">Водительское удостоверение (штат)</label>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setDriverLicense(true)}
            className={`flex-1 rounded-xl py-2 text-sm ${
              driverLicense
                ? "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)] ring-1 ring-[var(--dor-orange)]/50"
                : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
            }`}
          >
            Да
          </button>
          <button
            type="button"
            onClick={() => setDriverLicense(false)}
            className={`flex-1 rounded-xl py-2 text-sm ${
              !driverLicense
                ? "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)] ring-1 ring-[var(--dor-orange)]/50"
                : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
            }`}
          >
            Нет
          </button>
        </div>
      </div>

      {driverLicense && (
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-[var(--dor-muted)]">Категория прав</label>
          <select
            required
            className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
            value={licenseCategory}
            onChange={(e) => setLicenseCategory(e.target.value)}
          >
            <option value="">— выберите —</option>
            {LICENSE_CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="md:col-span-2 lg:col-span-3">
        <label className="text-xs text-[var(--dor-muted)]">Дата и время собеседования (удобные вам)</label>
        <input
          type="datetime-local"
          required
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
          value={interviewAt}
          onChange={(e) => setInterviewAt(e.target.value)}
        />
      </div>

      {err && (
        <p className="md:col-span-2 lg:col-span-3 text-sm text-red-400" role="alert">
          {err}
        </p>
      )}

      <div className="md:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={busy}
          className="dor-btn-primary w-full sm:w-auto disabled:opacity-50"
        >
          {busy ? "Отправка…" : "Отправить заявку на собеседование"}
        </button>
      </div>
    </form>
  );
}
