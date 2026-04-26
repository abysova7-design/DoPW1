"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PingReminder } from "@/components/PingReminder";
import { PreShiftChecklist } from "@/components/PreShiftChecklist";
import { DisciplineSection } from "@/components/DisciplineSection";
import { VehicleAssignments } from "@/components/VehicleAssignments";
import {
  RANK_LABELS,
  TASK_KIND_LABELS,
  canManageJobApplications,
  canTakeRoadPatrol,
  xpForLevel,
  type PositionRank,
} from "@/lib/positions";
import type { TaskKind } from "@prisma/client";
import { playSound } from "@/lib/sounds";
import { useRadio } from "@/components/RadioProvider";

type Me = {
  id: string;
  nickname: string;
  isAdmin: boolean;
  isDispatcher: boolean;
  positionRank: PositionRank;
  department: string | null;
  displayName: string | null;
  xp: number;
  level: number;
  towTruckCert: boolean;
  driverCert: boolean;
};

type Shift = {
  id: string;
  startedAt: string;
  tasks: { id: string; title: string; kind: TaskKind }[];
};

type DispatchCall = {
  id: string;
  title: string;
  body: string;
  status: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  creator: { nickname: string };
  targetId?: string | null;
  target?: { nickname: string } | null;
  reportText?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [openCalls, setOpenCalls] = useState<DispatchCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"main" | "vehicles" | "discipline">("main");
  const [focusCallPoint, setFocusCallPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [reportingCall, setReportingCall] = useState<DispatchCall | null>(null);
  const [reportText, setReportText] = useState("");
  const pingSectionRef = useRef<HTMLDivElement>(null);
  const knownCallIdsRef = useRef<Set<string>>(new Set());
  const meRef = useRef<Me | null>(null);
  const radio = useRadio();

  const refresh = useCallback(async () => {
    const [rme, rs, rdc] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/shift", { cache: "no-store" }),
      fetch("/api/dispatch", { cache: "no-store" }),
    ]);
    const dme = await rme.json().catch(() => ({}));
    if (!dme.user) { router.replace("/login"); return; }
    setMe(dme.user);
    meRef.current = dme.user;
    const ds = await rs.json().catch(() => ({}));
    setShift(ds.shift);
    const ddc = await rdc.json().catch(() => ({}));
    const nextCalls = (ddc.calls ?? []).filter(
      (c: DispatchCall) =>
        c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE",
    );
    const personalCalls =
      dme.user.isDispatcher || dme.user.isAdmin
        ? nextCalls.filter(
            (c: DispatchCall) => !c.targetId || c.targetId === dme.user.id,
          )
        : nextCalls;
    const newForMe = personalCalls.filter((c: DispatchCall) => !knownCallIdsRef.current.has(c.id));
    if (knownCallIdsRef.current.size > 0 && newForMe.length > 0) {
      playSound("dispatch");
    }
    personalCalls.forEach((c: DispatchCall) => knownCallIdsRef.current.add(c.id));
    setOpenCalls(personalCalls);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!focusCallPoint) return;
    pingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusCallPoint]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [refresh]);
  useEffect(() => {
    function onDispatchUpdated(e: Event) {
      const evt = e as CustomEvent<{ calls?: DispatchCall[] }>;
      let calls = (evt.detail?.calls ?? []).filter(
        (c) => c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE",
      );
      const u = meRef.current;
      if (u?.isDispatcher || u?.isAdmin) {
        calls = calls.filter((c) => !c.targetId || c.targetId === u.id);
      }
      setOpenCalls(calls);
    }
    window.addEventListener("dopw:dispatch-updated", onDispatchUpdated as EventListener);
    return () => window.removeEventListener("dopw:dispatch-updated", onDispatchUpdated as EventListener);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  async function startShift() {
    await fetch("/api/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    refresh();
  }

  async function endShift() {
    if (!confirm("Завершить смену? Все активные задачи будут закрыты.")) return;
    await fetch("/api/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    refresh();
  }

  async function startTask(kind: TaskKind) {
    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(e.error ?? "Не удалось начать задачу");
      return;
    }
    if (kind === "TOW_TRUCK") {
      router.push("/dashboard/evacuation");
      return;
    }
    if (kind === "ROAD_PATROL") {
      router.push("/dashboard/road-patrol");
      return;
    }
    refresh();
  }

  async function endTask() {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    refresh();
  }

  async function respondCall(call: DispatchCall, action: "accept" | "onsite") {
    const r = await fetch(`/api/dispatch/${call.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!r.ok) {
      return;
    }
    if (action === "accept" && call.lat != null && call.lng != null) {
      setFocusCallPoint({ lat: call.lat, lng: call.lng });
      setTab("main");
    }
    if (action === "onsite" && call.lat != null && call.lng != null) {
      setFocusCallPoint({ lat: call.lat, lng: call.lng });
      setTab("main");
    }
    refresh();
  }

  async function submitReport() {
    if (!reportingCall) return;
    const r = await fetch(`/api/dispatch/${reportingCall.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report", reportText }),
    });
    if (!r.ok) return;
    setReportingCall(null);
    setReportText("");
    refresh();
  }

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--dor-muted)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--dor-orange)] border-t-transparent" />
          Загрузка…
        </div>
      </div>
    );
  }

  const activeTask = shift?.tasks?.[0];
  const xpNeed = xpForLevel(me.level);
  const xpBar = Math.min(100, (me.xp / xpNeed) * 100);

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">

        {/* ── Профиль ── */}
        <div className="dor-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--dor-orange)] to-[var(--dor-green)] text-2xl font-bold text-white select-none">
                {(me.displayName ?? me.nickname).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold">{me.displayName ?? me.nickname}</h1>
                  {me.isDispatcher && (
                    <span className="rounded-md bg-[var(--dor-orange)]/20 px-1.5 py-0.5 text-xs font-semibold text-[var(--dor-orange)]">
                      📡 Диспетчер
                    </span>
                  )}
                  {me.isAdmin && (
                    <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-xs font-semibold text-blue-400">
                      👑 Администратор
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--dor-muted)]">
                  {RANK_LABELS[me.positionRank]}
                  {me.department ? ` · ${me.department}` : ""}
                </p>
                <p className="mt-1 text-xs text-[var(--dor-muted)]">
                  Рация: {radio.enabled ? `в канале (${radio.participants.length})` : "выключена"}
                </p>
                <div className="mt-2 w-48">
                  <div className="flex justify-between text-[10px] text-[var(--dor-muted)]">
                    <span>LVL {me.level}</span>
                    <span>{me.xp}/{xpNeed} XP</span>
                  </div>
                  <div
                    className="mt-0.5 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--dor-border)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(xpBar, xpBar > 0 ? 0 : 0)}%`,
                        background: "linear-gradient(to right, var(--dor-green), var(--dor-orange))",
                        minWidth: xpBar > 0 ? undefined : "0px",
                      }}
                    />
                  </div>
                  {me.xp === 0 && (
                    <div className="mt-0.5 text-[10px] text-[var(--dor-muted)]">
                      Первая эвакуация принесёт XP
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
              <NotificationsBell />
              {(me.isDispatcher || me.isAdmin) && (
                <Link href="/dashboard/dispatch" className="dor-btn-primary relative text-sm">
                  📡 Диспетчер
                  {openCalls.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {openCalls.length}
                    </span>
                  )}
                </Link>
              )}
              <button type="button" className="dor-btn-secondary text-sm" onClick={logout}>
                Выйти
              </button>
            </div>
          </div>
        </div>

        {/* ── Вызовы диспетчера ── */}
        {openCalls.length > 0 && (
          <div className="space-y-2">
            {openCalls.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dor-orange)]/50 bg-[var(--dor-orange)]/5 p-3"
              >
                <div>
                  <div className="text-sm font-semibold">📡 {c.title}</div>
                  <div className="text-xs text-[var(--dor-muted)]">
                    {c.body} · от {c.creator.nickname} · {new Date(c.createdAt).toLocaleTimeString("ru-RU")}
                  </div>
                </div>
                <div className="flex gap-2">
                  {c.status === "OPEN" && (
                    <button type="button" className="dor-btn-primary text-xs"
                      onClick={() => respondCall(c, "accept")}>Принять</button>
                  )}
                  {c.status === "ACCEPTED" && (
                    <button type="button" className="dor-btn-secondary text-xs"
                      onClick={() => respondCall(c, "onsite")}>На месте</button>
                  )}
                  {c.status === "ONSITE" && (
                    <button type="button" className="dor-btn-secondary text-xs"
                      onClick={() => {
                        setReportingCall(c);
                        setReportText("");
                      }}
                    >
                      Выполнено
                    </button>
                  )}
                  {c.lat != null && c.lng != null && (
                    <button
                      type="button"
                      className="dor-btn-secondary text-xs"
                      onClick={() => {
                        setFocusCallPoint({ lat: c.lat!, lng: c.lng! });
                        setTab("main");
                      }}
                    >
                      Показать точку на карте
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {reportingCall && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--dor-border)] bg-[var(--dor-night)] p-4">
              <h3 className="text-base font-semibold">Отчёт по вызову</h3>
              <p className="mt-1 text-xs text-[var(--dor-muted)]">
                {reportingCall.title}
              </p>
              <textarea
                className="mt-3 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-surface)] px-3 py-2 text-sm outline-none"
                rows={6}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Что произошло, что было сделано, итог..."
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="dor-btn-secondary text-sm"
                  onClick={() => setReportingCall(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="dor-btn-primary text-sm"
                  disabled={reportText.trim().length < 8}
                  onClick={submitReport}
                >
                  Отправить отчёт
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Смена ── */}
        <div className="dor-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Смена</h2>
            {!shift ? (
              <button type="button" className="dor-btn-primary text-sm" onClick={startShift}>
                ▶ Начать смену
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[var(--dor-green)]/10 border border-[var(--dor-green)]/30 px-3 py-1 text-xs">
                  🟢 С {new Date(shift.startedAt).toLocaleString("ru-RU")}
                </span>
                <button type="button" className="dor-btn-secondary text-sm" onClick={endShift}>
                  ■ Завершить
                </button>
              </div>
            )}
          </div>

          {/* Активная задача */}
          <div className="mt-4 border-t border-[var(--dor-border)] pt-4">
            {activeTask ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--dor-muted)]">Активная задача:</span>
                <span className="rounded-lg bg-[var(--dor-surface)] border border-[var(--dor-border)] px-3 py-1 text-sm font-medium">
                  {activeTask.title}
                </span>
                {activeTask.kind === "TOW_TRUCK" && (
                  <Link href="/dashboard/evacuation" className="dor-btn-primary text-xs">
                    🚛 Открыть панель
                  </Link>
                )}
                {activeTask.kind === "ROAD_PATROL" && (
                  <Link href="/dashboard/road-patrol" className="dor-btn-primary text-xs">
                    🛣️ Панель патруля
                  </Link>
                )}
                <button type="button" className="dor-btn-secondary text-xs" onClick={endTask}>
                  Завершить задачу
                </button>
              </div>
            ) : shift ? (
              <div>
                <p className="mb-2 text-sm text-[var(--dor-muted)]">Выберите задачу смены:</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(TASK_KIND_LABELS) as [TaskKind, string][]).map(([k, label]) => {
                    const needsCert = k === "TOW_TRUCK" && !me.towTruckCert;
                    const needsRank = k === "ROAD_PATROL" && !canTakeRoadPatrol(me.positionRank, me.isAdmin);
                    const locked = needsCert || needsRank;
                    const title = needsCert
                      ? "Требуется допуск на эвакуатор"
                      : needsRank
                        ? "Дорожный патруль со 2-го ранга (Engineer I) и выше"
                        : undefined;
                    return (
                      <button
                        key={k}
                        type="button"
                        title={title}
                        className={`dor-btn-secondary text-sm ${locked ? "opacity-40" : ""}`}
                        onClick={() => {
                          if (needsCert) router.push("/dashboard/knowledge/evacuation");
                          else if (!needsRank) startTask(k);
                        }}
                      >
                        {label}{locked ? " 🔒" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--dor-orange)]">Начните смену, чтобы взять задачу.</p>
            )}
          </div>
        </div>

        {/* ── Навигация вкладок ── */}
        <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--dor-border)] bg-[var(--dor-surface)]/60 p-1">
          {([
            ["main",       "📋 Главное"],
            ["vehicles",   "🚗 Машины"],
            ["discipline", "📜 Служба"],
          ] as [typeof tab, string][]).map(([t, l]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-w-[7rem] flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-[var(--dor-orange)] text-black"
                  : "text-[var(--dor-muted)] hover:text-[var(--dor-text)]"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Вкладка: Главное ── */}
        {tab === "main" && (
          <div className="space-y-6">
            {/* Чеклист */}
            <section className="dor-card p-5">
              <h2 className="mb-3 font-semibold">✅ Чек-лист перед заступлением</h2>
              <PreShiftChecklist />
            </section>

            {/* Каналы + Экзамены */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <Link href="/dashboard/channels"
                className="dor-card flex items-center gap-3 p-4 hover:border-[var(--dor-orange)]/50 transition">
                <span className="text-2xl">📡</span>
                <div>
                  <div className="font-medium text-sm">Каналы</div>
                  <div className="text-xs text-[var(--dor-muted)]">Приказы и аттестации</div>
                </div>
              </Link>
              <Link href="/dashboard/exams"
                className="dor-card flex items-center gap-3 p-4 hover:border-[var(--dor-orange)]/50 transition">
                <span className="text-2xl">🎓</span>
                <div>
                  <div className="font-medium text-sm">Экзамены</div>
                  <div className="text-xs text-[var(--dor-muted)]">Очередь и результаты</div>
                </div>
              </Link>
              {canManageJobApplications(me.positionRank, me.isAdmin) && (
                <Link href="/dashboard/applications"
                  className="dor-card flex items-center gap-3 p-4 hover:border-[var(--dor-orange)]/50 transition">
                  <span className="text-2xl">🧾</span>
                  <div>
                    <div className="font-medium text-sm">Заявки</div>
                    <div className="text-xs text-[var(--dor-muted)]">Рассмотрение соискателей</div>
                  </div>
                </Link>
              )}
              {me.isAdmin && (
                <Link href="/admin"
                  className="dor-card flex items-center gap-3 p-4 hover:border-blue-500/40 transition">
                  <span className="text-2xl">👑</span>
                  <div>
                    <div className="font-medium text-sm">Администрирование</div>
                    <div className="text-xs text-[var(--dor-muted)]">Пользователи, база ТС</div>
                  </div>
                </Link>
              )}
            </div>

            {/* Допуски */}
            <section className="dor-card p-5">
              <h2 className="mb-3 font-semibold text-sm text-[var(--dor-muted)] uppercase tracking-wider">Допуски</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                  me.towTruckCert ? "border-[var(--dor-green)]/40" : "border-[var(--dor-border)]"
                }`}>
                  <div>
                    <div className="text-sm font-medium">🚛 Эвакуатор</div>
                    <div className="text-xs text-[var(--dor-muted)]">
                      {me.towTruckCert ? "Допуск получен" : "Экзамен не сдан"}
                    </div>
                  </div>
                  {me.towTruckCert
                    ? <span className="text-[var(--dor-green-bright)] text-lg">✅</span>
                    : <Link href="/dashboard/knowledge/evacuation" className="dor-btn-primary text-xs">Учиться</Link>
                  }
                </div>
                <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                  me.driverCert ? "border-[var(--dor-green)]/40" : "border-[var(--dor-border)]"
                }`}>
                  <div>
                    <div className="text-sm font-medium">🚗 Водитель ТС</div>
                    <div className="text-xs text-[var(--dor-muted)]">
                      {me.driverCert ? "Допуск получен" : "Экзамен не сдан"}
                    </div>
                  </div>
                  {me.driverCert
                    ? <span className="text-[var(--dor-green-bright)] text-lg">✅</span>
                    : <Link href="/dashboard/knowledge/driver" className="dor-btn-primary text-xs">Учиться</Link>
                  }
                </div>
              </div>
            </section>

            {/* Контроль присутствия */}
            <div ref={pingSectionRef}>
              <PingReminder
                focusLat={focusCallPoint?.lat}
                focusLng={focusCallPoint?.lng}
              />
            </div>
          </div>
        )}

        {/* ── Вкладка: Машины ── */}
        {tab === "vehicles" && (
          <section className="dor-card p-5">
            <h2 className="mb-4 font-semibold">🚗 Закреплённые машины</h2>
            <p className="mb-3 text-sm text-[var(--dor-muted)]">
              Машины закрепляются администратором. Максимум 3 на сотрудника.
            </p>
            <VehicleAssignments userId={me.id} />
          </section>
        )}

        {/* ── Вкладка: Служба ── */}
        {tab === "discipline" && (
          <section className="dor-card p-5">
            <h2 className="mb-4 font-semibold">📜 Поощрения и взыскания</h2>
            <p className="mb-4 text-sm text-[var(--dor-muted)]">
              Выдаются Sub Director и выше, фиксируются в канале «Приказы».
            </p>
            <DisciplineSection
              userId={me.id}
              myRank={me.positionRank}
              isAdmin={me.isAdmin}
            />
          </section>
        )}
      </main>
    </div>
  );
}
