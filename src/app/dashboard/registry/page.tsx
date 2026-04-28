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

type LastRegistry = {
  at: string;
  plate: string;
  actorLabel: string;
  actionLabel: string;
  reason: string | null;
};

type LastEvac = {
  at: string;
  plate: string;
  actorLabel: string;
  violation: string;
};

type Stats = {
  totalVehicles: number;
  registryAddsLast7Days: number;
  lastRegistryAdd: LastRegistry | null;
  totalEvacuationsClosed: number;
  evacuationsClosedLast7Days: number;
  lastEvacuationClosed: LastEvac | null;
};

type TimelineRow = {
  id: string;
  kind: "REGISTRY" | "EVACUATION";
  at: string;
  plate: string;
  model: string | null;
  headline: string;
  detail: string | null;
  actorNickname: string;
  actorDisplayName: string | null;
};

export default function RegistryHistoryPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
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
    setTimeline(d.timeline ?? []);
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
              Внесения в базу ТС (патруль или администратор) с примечанием и{" "}
              <strong className="text-[var(--dor-text)]">закрытые эвакуации</strong> (номер, нарушение, кто закрыл
              тикет) — в одном журнале по времени.
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
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="dor-card border border-[var(--dor-border)] p-4">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Записей в реестре ТС</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--dor-text)]">
                  {stats.totalVehicles}
                </div>
              </div>
              <div className="dor-card border border-[var(--dor-border)] p-4">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Внесений в реестр за 7 дней</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--dor-orange)]">
                  {stats.registryAddsLast7Days}
                </div>
              </div>
              <div className="dor-card border border-blue-500/25 bg-blue-500/5 p-4">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Закрытых эвакуаций всего</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-blue-200">
                  {stats.totalEvacuationsClosed}
                </div>
              </div>
              <div className="dor-card border border-blue-500/25 bg-blue-500/5 p-4">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Эвакуаций закрыто за 7 дней</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-blue-300">
                  {stats.evacuationsClosedLast7Days}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="dor-card border border-[var(--dor-border)] p-5">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Последнее внесение в реестр</div>
                {stats.lastRegistryAdd ? (
                  <div className="mt-2 text-sm text-[var(--dor-text)]">
                    <div className="font-mono font-semibold text-[var(--dor-orange)]">{stats.lastRegistryAdd.plate}</div>
                    <div className="mt-1 text-xs text-[var(--dor-muted)]">
                      {stats.lastRegistryAdd.actorLabel} · {stats.lastRegistryAdd.actionLabel}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--dor-muted)]">
                      {new Date(stats.lastRegistryAdd.at).toLocaleString("ru-RU")}
                    </div>
                    {stats.lastRegistryAdd.reason ? (
                      <p className="mt-2 line-clamp-3 text-xs text-[var(--dor-muted)]">
                        Примечание: {stats.lastRegistryAdd.reason}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--dor-muted)]">Без примечания.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--dor-muted)]">Пока нет записей аудита.</p>
                )}
              </div>
              <div className="dor-card border border-blue-500/20 p-5">
                <div className="text-xs font-medium text-[var(--dor-muted)]">Последняя закрытая эвакуация</div>
                {stats.lastEvacuationClosed ? (
                  <div className="mt-2 text-sm text-[var(--dor-text)]">
                    <div className="font-mono font-semibold text-blue-200">{stats.lastEvacuationClosed.plate}</div>
                    <div className="mt-1 text-xs text-[var(--dor-muted)]">{stats.lastEvacuationClosed.actorLabel}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--dor-muted)]">
                      {new Date(stats.lastEvacuationClosed.at).toLocaleString("ru-RU")}
                    </div>
                    <p className="mt-2 line-clamp-4 text-xs text-[var(--dor-text)]">{stats.lastEvacuationClosed.violation}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--dor-muted)]">Закрытых эвакуаций пока нет.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <section className="dor-card p-5">
          <h2 className="text-lg font-semibold">Общий журнал</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">
            До 150 последних событий: внесения в реестр и закрытые эвакуации, по убыванию времени.
          </p>
          {timeline.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--dor-muted)]">Событий пока нет.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--dor-border)]">
              {timeline.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        e.kind === "EVACUATION"
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-[var(--dor-orange)]/20 text-[var(--dor-orange)]"
                      }`}
                    >
                      {e.kind === "EVACUATION" ? "Эвакуация" : "Реестр"}
                    </span>
                    <span className="font-mono font-semibold text-[var(--dor-text)]">{e.plate}</span>
                    {e.model ? <span className="text-xs text-[var(--dor-muted)]">· {e.model}</span> : null}
                  </div>
                  <div className="text-xs font-medium text-[var(--dor-text)]">{e.headline}</div>
                  <div className="text-xs text-[var(--dor-muted)]">
                    {e.actorDisplayName ?? e.actorNickname} · {new Date(e.at).toLocaleString("ru-RU")}
                  </div>
                  {e.detail ? (
                    <p className="mt-1 max-w-2xl text-sm leading-snug text-[var(--dor-muted)]">«{e.detail}»</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
