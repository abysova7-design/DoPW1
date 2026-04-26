"use client";

import { useCallback, useEffect, useState } from "react";
import { safeJson } from "@/lib/safe-fetch";
import { canIssueDiscipline, RANK_LABELS, type PositionRank } from "@/lib/positions";

type Record_ = {
  id: string;
  type: string;
  reason: string;
  createdAt: string;
  issuer: {
    nickname: string;
    displayName: string | null;
    positionRank: PositionRank;
  };
};

export function DisciplineSection({
  userId,
  myRank,
  isAdmin,
  targetNickname,
}: {
  userId: string;
  myRank: PositionRank;
  isAdmin: boolean;
  targetNickname?: string;
}) {
  const [records, setRecords] = useState<Record_[]>([]);
  const [type, setType] = useState<"AWARD" | "REPRIMAND">("AWARD");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const canIssue = canIssueDiscipline(myRank) || isAdmin;

  const load = useCallback(async () => {
    const r = await fetch(`/api/discipline?userId=${userId}`);
    if (!r.ok) return;
    const d = await safeJson<{ records?: Record_[] }>(r, {});
    setRecords(d.records ?? []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/discipline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, type, reason }),
    });
    const d = await safeJson<{ error?: string }>(r, {});
    if (!r.ok) { setMsg(d.error ?? "Ошибка оформления"); return; }
    setReason("");
    setMsg(type === "AWARD" ? "Поощрение выдано." : "Выговор вынесен.");
    load();
  }

  const awards = records.filter((r) => r.type === "AWARD").length;
  const reprimands = records.filter((r) => r.type === "REPRIMAND").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--dor-border)] px-3 py-1.5 text-sm">
          🏆 <span className="font-semibold text-[var(--dor-green-bright)]">{awards}</span>
          <span className="text-[var(--dor-muted)]">поощрений</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--dor-border)] px-3 py-1.5 text-sm">
          ⚠️ <span className="font-semibold text-red-400">{reprimands}</span>
          <span className="text-[var(--dor-muted)]">выговоров</span>
        </div>
      </div>

      {canIssue && (
        <form className="grid gap-2 rounded-xl border border-[var(--dor-border)] p-3 md:grid-cols-3" onSubmit={submit}>
          <select
            className="rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-1.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as "AWARD" | "REPRIMAND")}
          >
            <option value="AWARD">🏆 Поощрение</option>
            <option value="REPRIMAND">⚠️ Выговор</option>
          </select>
          <input
            className="rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-1.5 text-sm md:col-span-1"
            placeholder="Основание…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <button type="submit" className="dor-btn-primary text-sm">
            Выдать {targetNickname ? `(${targetNickname})` : ""}
          </button>
          {msg && <p className="col-span-3 text-xs text-[var(--dor-muted)]">{msg}</p>}
        </form>
      )}

      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {records.length === 0 ? (
          <p className="text-sm text-[var(--dor-muted)]">Записей нет.</p>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              className={`rounded-xl border p-2.5 text-sm ${
                rec.type === "AWARD"
                  ? "border-[var(--dor-green)]/40 bg-[var(--dor-green)]/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{rec.type === "AWARD" ? "🏆" : "⚠️"}</span>
                <span className="flex-1 font-medium">{rec.reason}</span>
                <span className="text-[10px] text-[var(--dor-muted)]">
                  {new Date(rec.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--dor-muted)]">
                {rec.issuer.displayName ?? rec.issuer.nickname} ·{" "}
                {RANK_LABELS[rec.issuer.positionRank]}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
