"use client";

import { useState } from "react";
import { safeJson } from "@/lib/safe-fetch";

export function StaffComplaintForm() {
  const [reporterName, setReporterName] = useState("");
  const [violatorName, setViolatorName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [evidenceLines, setEvidenceLines] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const urls = evidenceLines
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      const r = await fetch("/api/staff-complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName,
          violatorName,
          description,
          phone,
          evidenceUrls: urls,
        }),
      });
      const d = await safeJson<{ error?: string }>(r, {});
      if (!r.ok) {
        setErr(d.error ?? "Не удалось отправить");
        return;
      }
      setDone(true);
      setReporterName("");
      setViolatorName("");
      setDescription("");
      setPhone("");
      setEvidenceLines("");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--dor-green)]/40 bg-[var(--dor-green)]/10 p-6 text-center">
        <p className="text-base font-semibold text-[var(--dor-text)]">Жалоба принята</p>
        <p className="mt-2 text-sm text-[var(--dor-muted)]">
          Руководство и диспетчерский центр получили уведомление. При необходимости с вами свяжутся по
          указанным контактам.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={onSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-[var(--dor-muted)]">Ваше имя / ник (IC/OOC)</label>
          <input
            required
            className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div>
          <label className="text-xs text-[var(--dor-muted)]">На кого жалоба (ник или ФИО)</label>
          <input
            required
            className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
            value={violatorName}
            onChange={(e) => setViolatorName(e.target.value)}
            maxLength={120}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-[var(--dor-muted)]">Контакт (телефон в игре / Discord)</label>
        <input
          required
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
        />
      </div>
      <div>
        <label className="text-xs text-[var(--dor-muted)]">Описание нарушения</label>
        <textarea
          required
          rows={5}
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Дата, место, что произошло, свидетели…"
          minLength={15}
          maxLength={8000}
        />
      </div>
      <div>
        <label className="text-xs text-[var(--dor-muted)]">
          Ссылки на доказательства (необязательно), по одной в строке — только http(s)
        </label>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--dor-orange)]"
          value={evidenceLines}
          onChange={(e) => setEvidenceLines(e.target.value)}
          placeholder={"https://…"}
        />
      </div>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <button type="submit" disabled={busy} className="dor-btn-primary w-full sm:w-auto">
        {busy ? "Отправка…" : "Отправить жалобу"}
      </button>
    </form>
  );
}
