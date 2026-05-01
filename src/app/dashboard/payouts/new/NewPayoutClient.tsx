"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { PositionRank } from "@/lib/positions";

type PayoutKind = "MATERIAL_HELP" | "EVACUATION_PAY" | "OTHER";

const KIND_LABEL: Record<PayoutKind, string> = {
  MATERIAL_HELP: "Заявка на выплату материальной помощи",
  EVACUATION_PAY: "Заявка на выплату за эвакуации",
  OTHER: "Прочие выплаты",
};

export default function NewPayoutClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const kindParam = sp.get("kind") as PayoutKind | null;

  const kind: PayoutKind = useMemo(() => {
    if (kindParam === "MATERIAL_HELP" || kindParam === "EVACUATION_PAY" || kindParam === "OTHER") {
      return kindParam;
    }
    return "OTHER";
  }, [kindParam]);

  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [details, setDetails] = useState("");
  const [amountNote, setAmountNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
        else setMe({ isAdmin: d.user.isAdmin, positionRank: d.user.positionRank });
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMsg(null);
      setBusy(true);
      const r = await fetch("/api/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, details, amountNote: amountNote.trim() || null }),
      });
      setBusy(false);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(d.error ?? "Ошибка");
        return;
      }
      router.push("/dashboard/payouts");
    },
    [amountNote, details, kind, router],
  );

  if (!me) {
    return (
      <div className="dor-stripes min-h-screen">
        <SiteHeader authed />
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--dor-muted)]">…</div>
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed positionRank={me.positionRank} isAdmin={me.isAdmin} />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">{KIND_LABEL[kind]}</h1>
          <Link href="/dashboard/payouts" className="dor-btn-secondary text-sm">
            Назад
          </Link>
        </div>

        <form onSubmit={submit} className="dor-card space-y-4 p-5">
          <p className="text-xs text-[var(--dor-muted)]">
            Опишите основание: даты, номера тикетов, реквизиты для связи в игре и т.д. Заявка уйдёт
            администраторам на рассмотрение.
          </p>
          <div>
            <label className="text-xs text-[var(--dor-muted)]">Текст заявки *</label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required
              minLength={15}
              maxLength={4000}
              placeholder="Подробное описание (не менее 15 символов)…"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--dor-muted)]">Сумма или ориентир (необязательно)</label>
            <input
              className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none"
              value={amountNote}
              onChange={(e) => setAmountNote(e.target.value)}
              maxLength={200}
              placeholder="Например: ориентир 50 000 $ на сервере"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="dor-btn-primary text-sm disabled:opacity-50">
              Отправить
            </button>
            <Link href="/dashboard/payouts" className="dor-btn-secondary inline-flex items-center text-sm">
              Отмена
            </Link>
          </div>
          {msg ? <p className="text-sm text-red-400">{msg}</p> : null}
        </form>
      </main>
    </div>
  );
}
