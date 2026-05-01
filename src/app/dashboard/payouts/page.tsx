"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { PositionRank } from "@/lib/positions";

type PayoutKind = "MATERIAL_HELP" | "EVACUATION_PAY" | "OTHER";
type PayoutStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

const KIND_LABEL: Record<PayoutKind, string> = {
  MATERIAL_HELP: "Материальная помощь",
  EVACUATION_PAY: "Выплата за эвакуации",
  OTHER: "Прочие выплаты",
};

const STATUS_LABEL: Record<PayoutStatus, string> = {
  PENDING: "На рассмотрении",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  PAID: "Выплачено",
};

type Row = {
  id: string;
  kind: PayoutKind;
  details: string;
  amountNote: string | null;
  status: PayoutStatus;
  adminNote: string | null;
  payoutDetails: string | null;
  createdAt: string;
};

export default function PayoutsHubPage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!d.user) {
      router.replace("/login");
      return;
    }
    setMe({ isAdmin: d.user.isAdmin, positionRank: d.user.positionRank });
    const pr = await fetch("/api/payout-requests", { cache: "no-store" });
    if (!pr.ok) {
      setRows([]);
      setLoading(false);
      return;
    }
    const pd = await pr.json().catch(() => ({}));
    setRows(pd.requests ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !me) {
    return (
      <div className="dor-stripes min-h-screen">
        <SiteHeader authed positionRank={me?.positionRank} isAdmin={me?.isAdmin} />
        <div className="flex min-h-[40vh] items-center justify-center text-[var(--dor-muted)]">
          Загрузка…
        </div>
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed positionRank={me.positionRank} isAdmin={me.isAdmin} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Заявки на выплату</h1>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            Кабинет
          </Link>
        </div>

        <p className="text-sm text-[var(--dor-muted)]">
          Подайте заявку — администратор рассмотрит её и сменит статус. При каждом изменении статуса вы
          получите уведомление в колокольчике.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/dashboard/payouts/new?kind=MATERIAL_HELP"
            className="dor-card p-4 hover:border-emerald-500/40 transition"
          >
            <div className="text-lg font-semibold">🤝 Матпомощь</div>
            <p className="mt-1 text-xs text-[var(--dor-muted)]">Заявка на выплату материальной помощи</p>
          </Link>
          <Link
            href="/dashboard/payouts/new?kind=EVACUATION_PAY"
            className="dor-card p-4 hover:border-emerald-500/40 transition"
          >
            <div className="text-lg font-semibold">🚛 Эвакуации</div>
            <p className="mt-1 text-xs text-[var(--dor-muted)]">Заявка на выплату за эвакуации</p>
          </Link>
          <Link
            href="/dashboard/payouts/new?kind=OTHER"
            className="dor-card p-4 hover:border-emerald-500/40 transition"
          >
            <div className="text-lg font-semibold">📎 Прочее</div>
            <p className="mt-1 text-xs text-[var(--dor-muted)]">Иные выплаты и компенсации</p>
          </Link>
        </div>

        <section className="dor-card p-5">
          <h2 className="font-semibold">Мои заявки</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--dor-muted)]">Пока нет отправленных заявок.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)]/80 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--dor-orange)]">
                      {KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        r.status === "PAID"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : r.status === "REJECTED"
                            ? "bg-red-500/15 text-red-300"
                            : r.status === "APPROVED"
                              ? "bg-blue-500/15 text-blue-300"
                              : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                      }`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[var(--dor-muted)]">{r.details}</p>
                  {r.amountNote ? (
                    <p className="mt-1 text-xs text-[var(--dor-muted)]">Сумма / ориентир: {r.amountNote}</p>
                  ) : null}
                  {r.adminNote ? (
                    <p className="mt-2 rounded-lg border border-[var(--dor-border)] bg-[var(--dor-surface)]/50 p-2 text-xs">
                      <span className="font-semibold text-[var(--dor-text)]">Ответ администратора: </span>
                      {r.adminNote}
                    </p>
                  ) : null}
                  {r.payoutDetails ? (
                    <p className="mt-2 text-xs text-emerald-300/90">
                      <span className="font-semibold">Выплата: </span>
                      {r.payoutDetails}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] text-[var(--dor-muted)]">
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
