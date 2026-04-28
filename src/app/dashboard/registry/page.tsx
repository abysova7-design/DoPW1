"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { PositionRank } from "@/lib/positions";

type Me = {
  isAdmin: boolean;
  positionRank: PositionRank;
};

type LastAdd = {
  at: string;
  plate: string;
  actorLabel: string;
  actionLabel: string;
  reason: string | null;
};

type Stats = {
  totalVehicles: number;
  registryAddsLast7Days: number;
  lastAdd: LastAdd | null;
};

type EventRow = {
  id: string;
  at: string;
  plate: string;
  model: string | null;
  actionLabel: string;
  reason: string | null;
  actorNickname: string;
  actorDisplayName: string | null;
};

export default function RegistryHistoryPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rme = await fetch("/api/auth/me", { cache: "no-store" });
    const dme = await rme.json().catch(() => ({}));
    if (!dme.user) {
      router.replace("/login");
      return;
    }
    setMe({ isAdmin: dme.user.isAdmin, positionRank: dme.user.positionRank });

    const r = await fetch("/api/vehicles/registry-audit", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Нет доступа");
      return;
    }
    setStats(d.stats ?? null);
    setEvents(d.events ?? []);
    setMsg(null);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--dor-orange)]">
              Реестр транспорта
            </p>
            <h1 className="mt-1 text-2xl font-bold">История пополнения и статистика</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--dor-muted)]">
              Кто вносил записи в базу ТС (патруль или администратор) и с какой причиной в поле примечания.
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            ← Кабинет
          </Link>
        </div>

        {msg ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">{msg}</p>
        ) : null}

        {stats ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="dor-card border border-[var(--dor-border)] p-5">
              <div className="text-xs font-medium text-[var(--dor-muted)]">Записей в реестре</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--dor-text)]">
                {stats.totalVehicles}
              </div>
            </div>
            <div className="dor-card border border-[var(--dor-border)] p-5">
              <div className="text-xs font-medium text-[var(--dor-muted)]">Новых записей за 7 дней</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--dor-orange)]">
                {stats.registryAddsLast7Days}
              </div>
            </div>
            <div className="dor-card border border-[var(--dor-border)] p-5 sm:col-span-1">
              <div className="text-xs font-medium text-[var(--dor-muted)]">Последнее пополнение</div>
              {stats.lastAdd ? (
                <div className="mt-2 text-sm text-[var(--dor-text)]">
                  <div className="font-mono font-semibold text-[var(--dor-orange)]">{stats.lastAdd.plate}</div>
                  <div className="mt-1 text-xs text-[var(--dor-muted)]">
                    {stats.lastAdd.actorLabel} · {stats.lastAdd.actionLabel}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--dor-muted)]">
                    {new Date(stats.lastAdd.at).toLocaleString("ru-RU")}
                  </div>
                  {stats.lastAdd.reason ? (
                    <p className="mt-2 line-clamp-3 text-xs text-[var(--dor-muted)]">Причина / примечание: {stats.lastAdd.reason}</p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--dor-muted)]">Примечание не указано.</p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--dor-muted)]">Событий пока нет.</p>
              )}
            </div>
          </div>
        ) : null}

        <section className="dor-card p-5">
          <h2 className="text-lg font-semibold">Журнал внесений</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">До 120 последних операций.</p>
          {events.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--dor-muted)]">Записей в журнале нет.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--dor-border)]">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--dor-orange)]">{e.plate}</span>
                      {e.model ? (
                        <span className="text-xs text-[var(--dor-muted)]">· {e.model}</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-[var(--dor-muted)]">
                      {e.actorDisplayName ?? e.actorNickname} · {e.actionLabel}
                    </div>
                    <div className="text-[11px] text-[var(--dor-muted)]">
                      {new Date(e.at).toLocaleString("ru-RU")}
                    </div>
                    {e.reason ? (
                      <p className="mt-2 max-w-xl text-sm text-[var(--dor-text)]">«{e.reason}»</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
