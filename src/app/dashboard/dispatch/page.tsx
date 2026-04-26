"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DispatchMapClient } from "@/components/DispatchMapClient";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import type { PositionRank } from "@/lib/positions";
import { RANK_LABELS } from "@/lib/positions";
import { useRadio } from "@/components/RadioProvider";
import { playSound } from "@/lib/sounds";
import { CIVIC_CATEGORY_LABELS, isCivicCategory } from "@/lib/civic-help";
import type { CheckpointMarker } from "@/components/DispatchMap";
import { PATROL_CHECKPOINTS, PATROL_REPORT_KINDS, PATROL_REPORT_STATUS_RU } from "@/lib/road-patrol";

type CivicRequest = {
  id: string;
  fullName: string;
  category: string;
  description: string;
  phone: string;
  lat: number;
  lng: number;
  endLat: number | null;
  endLng: number | null;
  status: string;
  createdAt: string;
};

type Worker = {
  shiftId: string;
  shiftStartedAt: string;
  user: {
    id: string;
    nickname: string;
    displayName: string | null;
    positionRank: PositionRank;
    department: string | null;
    isDispatcher: boolean;
  };
  lastPing: {
    lat: number;
    lng: number;
    createdAt: string;
    label: string | null;
  } | null;
  activeEvacuation: {
    id: string;
    status: string;
    plate: string;
  } | null;
  activeTask: {
    kind: string;
    title: string;
    startedAt: string;
  } | null;
};

type RoadClosureRow = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  createdAt: string;
  authorId: string;
  author: { nickname: string; displayName: string | null };
};

type CheckpointDutyBundle = {
  checkpointId: number;
  users: { id: string; nickname: string; displayName: string | null }[];
};

type RoadPatrolReportRow = {
  id: string;
  kind: string;
  note: string;
  citizenNickname?: string | null;
  photoUrls?: string;
  lat: number | null;
  lng: number | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  author: { nickname: string; displayName: string | null };
};

type Call = {
  id: string;
  title: string;
  body: string;
  status: string;
  lat: number | null;
  lng: number | null;
  endLat?: number | null;
  endLng?: number | null;
  createdAt: string;
  creator: { nickname: string; displayName: string | null };
  target: { nickname: string; displayName: string | null } | null;
  reportText?: string | null;
  reportAt?: string | null;
  reportBy?: { nickname: string; displayName: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Открыт",
  ACCEPTED: "Принят",
  ONSITE: "На месте",
  REPORTED: "Отчёт отправлен",
  DONE: "Выполнен",
  CANCELLED: "Отменён",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-[var(--dor-orange)]",
  ACCEPTED: "text-[var(--dor-green-bright)]",
  ONSITE: "text-blue-400",
  REPORTED: "text-purple-400",
  DONE: "text-[var(--dor-muted)]",
  CANCELLED: "text-red-400",
};

export default function DispatchPage() {
  const router = useRouter();
  const radio = useRadio();
  const [me, setMe] = useState<{
    isAdmin: boolean;
    isDispatcher: boolean;
    positionRank: PositionRank;
    nickname: string;
  } | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [civicRequests, setCivicRequests] = useState<CivicRequest[]>([]);
  const [civicPollReady, setCivicPollReady] = useState(false);
  const [patrolReports, setPatrolReports] = useState<RoadPatrolReportRow[]>([]);
  const [patrolReportDetail, setPatrolReportDetail] = useState<RoadPatrolReportRow | null>(null);
  const [patrolReviewNote, setPatrolReviewNote] = useState("");
  const [closures, setClosures] = useState<RoadClosureRow[]>([]);
  const [civicAssignId, setCivicAssignId] = useState<string | null>(null);
  const [civicEmployeeId, setCivicEmployeeId] = useState("");
  const [civicBusy, setCivicBusy] = useState(false);
  const civicSectionRef = useRef<HTMLDivElement | null>(null);
  const knownCivicIds = useRef<Set<string>>(new Set());
  const civicSoundPrimed = useRef(false);

  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [targetId, setTargetId] = useState("");
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkpointDuties, setCheckpointDuties] = useState<CheckpointDutyBundle[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!d.user) { router.replace("/login"); return; }
    if (!d.user.isDispatcher && !d.user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    setMe(d.user);

    const w = await fetch("/api/dispatch/workers", { cache: "no-store" });
    const wd = await w.json().catch(() => ({}));
    setWorkers(wd.workers ?? []);
    setCheckpointDuties(wd.checkpointDuties ?? []);

    const c = await fetch("/api/dispatch", { cache: "no-store" });
    const cd = await c.json().catch(() => ({}));
    setCalls(cd.calls ?? []);

    const civ = await fetch("/api/public-assistance", { cache: "no-store" });
    if (civ.ok) {
      const civd = await civ.json().catch(() => ({}));
      setCivicRequests(civd.requests ?? []);
      setCivicPollReady(true);
    } else {
      setCivicRequests([]);
    }

    const pr = await fetch("/api/road-patrol/reports", { cache: "no-store" });
    if (pr.ok) {
      const prd = await pr.json().catch(() => ({}));
      setPatrolReports(prd.reports ?? []);
    }

    const cl = await fetch("/api/road-patrol/closures", { cache: "no-store" });
    if (cl.ok) {
      const cld = await cl.json().catch(() => ({}));
      setClosures(cld.closures ?? []);
    } else {
      setClosures([]);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    function onDispatchUpdated(e: Event) {
      const evt = e as CustomEvent<{ calls?: Call[] }>;
      setCalls(evt.detail?.calls ?? []);
    }
    window.addEventListener("dopw:dispatch-updated", onDispatchUpdated as EventListener);
    return () => window.removeEventListener("dopw:dispatch-updated", onDispatchUpdated as EventListener);
  }, []);

  useEffect(() => {
    if (!civicPollReady) return;
    const open = civicRequests.filter((r) => r.status === "OPEN");
    if (!civicSoundPrimed.current) {
      open.forEach((r) => knownCivicIds.current.add(r.id));
      civicSoundPrimed.current = true;
      return;
    }
    const newcomers = open.filter((r) => !knownCivicIds.current.has(r.id));
    newcomers.forEach((r) => knownCivicIds.current.add(r.id));
    if (newcomers.length > 0) {
      playSound("alert");
      civicSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [civicRequests, civicPollReady]);

  async function sendCall(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        bodyText,
        targetId: targetId || null,
        lat: pickedLat,
        lng: pickedLng,
      }),
    });
    setBusy(false);
    if (!r.ok) { const e2 = await r.json().catch(() => ({})); setMsg(e2.error ?? "Ошибка"); return; }
    setTitle(""); setBodyText(""); setTargetId(""); setPickedLat(null); setPickedLng(null);
    setMsg("Вызов создан.");
    load();
  }

  async function patchCall(id: string, action: string) {
    await fetch(`/api/dispatch/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  }

  async function closeRoadClosure(id: string) {
    const r = await fetch(`/api/road-patrol/closures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    if (!r.ok) {
      const e2 = await r.json().catch(() => ({}));
      setMsg(e2.error ?? "Не удалось снять перекрытие");
      return;
    }
    setMsg("Перекрытие снято с карты.");
    load();
  }

  async function submitCivicAssign() {
    if (!civicAssignId || !civicEmployeeId) return;
    setCivicBusy(true);
    const r = await fetch(`/api/public-assistance/${civicAssignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", employeeUserId: civicEmployeeId }),
    });
    setCivicBusy(false);
    if (!r.ok) {
      const e2 = await r.json().catch(() => ({}));
      setMsg(e2.error ?? "Ошибка назначения");
      return;
    }
    setCivicAssignId(null);
    setCivicEmployeeId("");
    setMsg("Вызов адресован сотруднику.");
    load();
  }

  async function cancelCivic(id: string) {
    await fetch(`/api/public-assistance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    load();
  }

  async function reviewPatrolReport(id: string, action: "approve" | "reject") {
    await fetch(`/api/road-patrol/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewNote: patrolReviewNote }),
    });
    setPatrolReportDetail(null);
    setPatrolReviewNote("");
    load();
  }

  const workerMarkers = workers
    .filter((w) => w.lastPing)
    .map((w) => {
      const stale =
        w.lastPing
          ? new Date().getTime() - new Date(w.lastPing.createdAt).getTime() >
            20 * 60 * 1000
          : true;
      return {
        userId: w.user.id,
        nickname: w.user.nickname,
        lat: w.lastPing!.lat,
        lng: w.lastPing!.lng,
        stale,
        evacuating: Boolean(w.activeEvacuation),
        roadPatrol: w.activeTask?.kind === "ROAD_PATROL",
      };
    });
  const activeEvacuations = workers.filter((w) => w.activeEvacuation);
  const activeCallMarkers = calls
    .filter((c) => (c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE" || c.status === "REPORTED") && c.lat != null && c.lng != null)
    .map((c) => ({
      id: c.id,
      lat: c.lat as number,
      lng: c.lng as number,
      title: c.title,
      endLat: c.endLat,
      endLng: c.endLng,
    }));
  const closureMapMarkers = closures.map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    title: c.title,
    description: c.description,
  }));
  const patrolReportMapMarkers = patrolReports
    .filter(
      (r) =>
        r.status !== "APPROVED" &&
        r.lat != null &&
        r.lng != null &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng),
    )
    .map((r) => ({
      id: r.id,
      lat: r.lat as number,
      lng: r.lng as number,
      label: `${(PATROL_REPORT_KINDS as Record<string, string>)[r.kind] ?? r.kind} · ${r.author.displayName ?? r.author.nickname}`,
    }));

  const dispatchCheckpointMarkers: CheckpointMarker[] = PATROL_CHECKPOINTS.map((c) => ({
    id: `cp-${c.id}`,
    lat: c.lat,
    lng: c.lng,
    label: c.label,
    variant: "fixed" as const,
    stationaryCheckpointId: c.id,
    occupants:
      checkpointDuties.find((d) => d.checkpointId === c.id)?.users.map((u) => ({
        nickname: u.nickname,
        displayName: u.displayName,
      })) ?? [],
  }));

  const EVAC_STATUS_RU: Record<string, string> = {
    ACTIVE: "Ведется эвакуация",
    DELIVERED: "В пути",
  };

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Проверка доступа…
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">📡 Диспетчерский центр</h1>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              Координация персонала на смене · обновление каждые 15 сек
            </p>
            <p className="mt-1 text-xs text-[var(--dor-muted)]">
              Рация: {radio.enabled ? `активна (${radio.participants.length} в канале)` : "выключена"}
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            ← Кабинет
          </Link>
        </div>

        <section className="dor-card p-5">
          <h2 className="font-semibold">Карта — расположение сотрудников</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">
            Оранжевые точки — сотрудники с активной сменой (данные с последнего чек-ина). Ромбы КП: оранжевый — пост
            свободен, зелёный — на посту заступили (наведите на маркер — имена). ⛔ — перекрытия от патруля; бирюзовые
            🛣️ — отчёты патруля с координатами. Красный/зелёный вызов с линией — маршрут (А→Б). Кликните по карте,
            чтобы отметить точку вызова.
          </p>
          <div className="mt-3">
            <DispatchMapClient
              workers={workerMarkers}
              checkpointMarkers={dispatchCheckpointMarkers}
              callMarkers={activeCallMarkers}
              closureMarkers={closureMapMarkers}
              patrolReportMarkers={patrolReportMapMarkers}
              onPick={(a, b) => { setPickedLat(a); setPickedLng(b); }}
              pickedLat={pickedLat}
              pickedLng={pickedLng}
            />
          </div>
          <div className="mt-4 border-t border-[var(--dor-border)] pt-4">
            <h3 className="text-sm font-semibold">⛔ Перекрытия (дорожный патруль)</h3>
            {closures.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--dor-muted)]">Нет активных меток.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {closures.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-[var(--dor-muted)]">
                        {c.author.displayName ?? c.author.nickname} · {Math.round(c.lat)}, {Math.round(c.lng)} ·{" "}
                        {new Date(c.createdAt).toLocaleString("ru-RU")}
                      </div>
                      {c.description ? (
                        <p className="mt-1 text-xs text-[var(--dor-muted)]">{c.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="dor-btn-secondary shrink-0 text-xs"
                      onClick={() => closeRoadClosure(c.id)}
                    >
                      Снять с карты
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="dor-card p-5 lg:col-span-2">
            <h2 className="font-semibold">🚛 Активные эвакуации</h2>
            <div className="mt-3 space-y-2">
              {activeEvacuations.length === 0 ? (
                <p className="text-sm text-[var(--dor-muted)]">Сейчас активных эвакуаций нет.</p>
              ) : (
                activeEvacuations.map((w) => (
                  <div
                    key={w.activeEvacuation!.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/35 bg-blue-500/5 p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {w.user.displayName ?? w.user.nickname} · {w.activeEvacuation!.plate || "без номера"}
                      </div>
                      <p className="text-xs text-[var(--dor-muted)]">
                        Статус: {EVAC_STATUS_RU[w.activeEvacuation!.status] ?? w.activeEvacuation!.status}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/dispatch/evacuation/${w.activeEvacuation!.id}`}
                      className="dor-btn-secondary text-xs"
                    >
                      Открыть карточку
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="dor-card p-5">
            <h2 className="font-semibold">На смене ({workers.length})</h2>
            <ul className="mt-3 space-y-2">
              {workers.length === 0 ? (
                <p className="text-sm text-[var(--dor-muted)]">Нет активных смен.</p>
              ) : (
                workers.map((w) => (
                  <li
                    key={w.shiftId}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--dor-border)] p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {w.user.displayName ?? w.user.nickname}
                        {w.user.isDispatcher ? (
                          <span className="ml-2 rounded bg-[var(--dor-orange)]/20 px-1 text-xs text-[var(--dor-orange)]">
                            диспетчер
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--dor-muted)]">
                        {RANK_LABELS[w.user.positionRank]}
                        {w.user.department ? ` · ${w.user.department}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-[var(--dor-muted)]">
                        Смена с {new Date(w.shiftStartedAt).toLocaleTimeString("ru-RU")}
                        {w.lastPing
                          ? ` · чек-ин ${new Date(w.lastPing.createdAt).toLocaleTimeString("ru-RU")}`
                          : " · нет чек-ина"}
                      </div>
                      {w.activeTask && (
                        <div className="mt-1 text-xs text-[var(--dor-orange)]">
                          Задача: {w.activeTask.title}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="dor-btn-secondary text-xs"
                      onClick={() => setTargetId(w.user.id)}
                    >
                      Вызвать
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="dor-card p-5">
            <h2 className="font-semibold">Создать вызов</h2>
            <form className="mt-3 space-y-3" onSubmit={sendCall}>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">Заголовок</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Напр: Срочный выезд на Groove St."
                />
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">Задача</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                  rows={3}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  required
                  placeholder="Опишите задачу подробно…"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">
                  Адресат (необязательно — оставьте пустым для всей смены)
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">— Всем на смене —</option>
                  {workers.map((w) => (
                    <option key={w.user.id} value={w.user.id}>
                      {w.user.displayName ?? w.user.nickname}
                    </option>
                  ))}
                </select>
              </div>
              {pickedLat != null ? (
                <p className="text-xs text-[var(--dor-muted)]">
                  📍 Точка на карте: {pickedLat.toFixed(0)},{pickedLng?.toFixed(0)}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="dor-btn-primary text-sm disabled:opacity-50"
              >
                Отправить вызов
              </button>
              {msg ? <p className="text-sm text-[var(--dor-muted)]">{msg}</p> : null}
            </form>
          </section>
        </div>

        <div ref={civicSectionRef} className="dor-card p-5">
          <h2 className="font-semibold">Гражданская помощь</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">
            Обращения с публичной страницы «Помощь». Примите вызов и выберите сотрудника —
            задача уйдёт в обычные активные вызовы.
          </p>
          <div className="mt-3 space-y-3">
            {civicRequests.length === 0 ? (
              <p className="text-sm text-[var(--dor-muted)]">Нет открытых обращений.</p>
            ) : (
              civicRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-amber-100">
                      {isCivicCategory(req.category)
                        ? CIVIC_CATEGORY_LABELS[req.category]
                        : req.category}{" "}
                      · {req.fullName}
                    </div>
                    <span className="text-xs font-semibold text-amber-400">
                      {req.status === "OPEN" ? "Новое" : req.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--dor-muted)]">{req.description}</p>
                  <p className="mt-1 text-xs text-[var(--dor-muted)]">📞 {req.phone}</p>
                  <p className="mt-1 text-xs text-[var(--dor-muted)]">
                    📍 А: {Math.round(req.lat)}, {Math.round(req.lng)}
                    {req.endLat != null && req.endLng != null
                      ? ` · Б: ${Math.round(req.endLat)}, ${Math.round(req.endLng)}`
                      : ""}{" "}
                    · {new Date(req.createdAt).toLocaleString("ru-RU")}
                  </p>
                  {req.status === "OPEN" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="dor-btn-primary text-xs"
                        onClick={() => {
                          setCivicAssignId(req.id);
                          setCivicEmployeeId(workers[0]?.user.id ?? "");
                        }}
                      >
                        Принять и назначить
                      </button>
                      <button
                        type="button"
                        className="dor-btn-secondary text-xs"
                        onClick={() => cancelCivic(req.id)}
                      >
                        Отклонить
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        {civicAssignId ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="dor-card max-w-md space-y-4 p-5">
              <h3 className="font-semibold">Назначить сотрудника</h3>
              <p className="text-sm text-[var(--dor-muted)]">
                Выберите сотрудника на смене — ему придёт уведомление и вызов в личном кабинете.
              </p>
              <select
                className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                value={civicEmployeeId}
                onChange={(e) => setCivicEmployeeId(e.target.value)}
              >
                {workers.map((w) => (
                  <option key={w.user.id} value={w.user.id}>
                    {w.user.displayName ?? w.user.nickname}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="dor-btn-primary text-sm disabled:opacity-50"
                  disabled={civicBusy || !civicEmployeeId}
                  onClick={() => submitCivicAssign()}
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  className="dor-btn-secondary text-sm"
                  disabled={civicBusy}
                  onClick={() => {
                    setCivicAssignId(null);
                    setCivicEmployeeId("");
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="dor-card p-5">
          <h2 className="font-semibold">🛣️ Отчёты дорожного патруля</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">
            Проверка действий патруля: заправки, ремонты, блок-посты и др. (+XP сотруднику уже начислен при отправке.)
          </p>
          <div className="mt-3 space-y-2">
            {patrolReports.filter((r) => r.status === "PENDING" || r.status === "NEEDS_WORK").length ===
            0 ? (
              <p className="text-sm text-[var(--dor-muted)]">Нет отчётов на проверке.</p>
            ) : (
              patrolReports
                .filter((r) => r.status === "PENDING" || r.status === "NEEDS_WORK")
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {(PATROL_REPORT_KINDS as Record<string, string>)[r.kind] ?? r.kind} ·{" "}
                        {r.author.displayName ?? r.author.nickname}
                      </div>
                      <div className="text-xs text-[var(--dor-muted)]">
                        {new Date(r.createdAt).toLocaleString("ru-RU")} ·{" "}
                        {PATROL_REPORT_STATUS_RU[r.status] ?? r.status}
                      </div>
                      {r.note ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--dor-muted)]">{r.note}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="dor-btn-secondary text-xs"
                      onClick={() => {
                        setPatrolReportDetail(r);
                        setPatrolReviewNote("");
                      }}
                    >
                      Открыть
                    </button>
                  </div>
                ))
            )}
          </div>
        </section>

        {patrolReportDetail ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="dor-card max-h-[90vh] max-w-lg space-y-3 overflow-y-auto p-5">
              <h3 className="font-semibold">Отчёт патруля</h3>
              <p className="text-sm text-[var(--dor-muted)]">
                {(PATROL_REPORT_KINDS as Record<string, string>)[patrolReportDetail.kind] ??
                  patrolReportDetail.kind}{" "}
                · {patrolReportDetail.author.displayName ?? patrolReportDetail.author.nickname}
              </p>
              <p className="text-xs text-[var(--dor-muted)]">
                {new Date(patrolReportDetail.createdAt).toLocaleString("ru-RU")} · статус:{" "}
                {PATROL_REPORT_STATUS_RU[patrolReportDetail.status] ?? patrolReportDetail.status}
              </p>
              {patrolReportDetail.lat != null && patrolReportDetail.lng != null ? (
                <p className="text-xs">
                  📍 {Math.round(patrolReportDetail.lat)}, {Math.round(patrolReportDetail.lng)}
                </p>
              ) : null}
              {patrolReportDetail.citizenNickname ? (
                <p className="text-sm">
                  <span className="text-[var(--dor-muted)]">Гражданин (RP): </span>
                  {patrolReportDetail.citizenNickname}
                </p>
              ) : null}
              <div className="rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] p-3 text-sm whitespace-pre-wrap">
                {patrolReportDetail.note || "—"}
              </div>
              {(() => {
                let urls: string[] = [];
                try {
                  urls = JSON.parse(patrolReportDetail.photoUrls ?? "[]") as string[];
                } catch {
                  urls = [];
                }
                if (!urls.length) return null;
                return (
                  <div>
                    <p className="mb-2 text-xs text-[var(--dor-muted)]">Вложения</p>
                    <div className="flex flex-wrap gap-2">
                      {urls.map((u, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={u}
                          alt=""
                          className="h-24 max-w-[140px] rounded-lg border border-[var(--dor-border)] object-cover"
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}
              <label className="text-xs text-[var(--dor-muted)]">Комментарий диспетчера</label>
              <textarea
                className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                rows={3}
                value={patrolReviewNote}
                onChange={(e) => setPatrolReviewNote(e.target.value)}
                placeholder="При отклонении укажите, что исправить…"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="dor-btn-primary text-sm"
                  onClick={() => reviewPatrolReport(patrolReportDetail.id, "approve")}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="dor-btn-secondary text-sm"
                  onClick={() => reviewPatrolReport(patrolReportDetail.id, "reject")}
                >
                  Вернуть на доработку
                </button>
                <button
                  type="button"
                  className="dor-btn-secondary text-sm"
                  onClick={() => {
                    setPatrolReportDetail(null);
                    setPatrolReviewNote("");
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="dor-card p-5">
          <h2 className="font-semibold">Активные вызовы</h2>
          <div className="mt-3 space-y-3">
            {calls.length === 0 ? (
              <p className="text-sm text-[var(--dor-muted)]">Нет открытых вызовов.</p>
            ) : (
              calls.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-[var(--dor-border)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{c.title}</div>
                    <span className={`text-xs font-semibold ${STATUS_COLOR[c.status] ?? ""}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--dor-muted)]">{c.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--dor-muted)]">
                    <span>Диспетчер: {c.creator.displayName ?? c.creator.nickname}</span>
                    {c.target ? (
                      <span>→ {c.target.displayName ?? c.target.nickname}</span>
                    ) : (
                      <span>→ Всем на смене</span>
                    )}
                    <span>{new Date(c.createdAt).toLocaleString("ru-RU")}</span>
                  </div>
                  {c.reportText && (
                    <div className="mt-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-2 text-xs">
                      <div className="font-semibold text-purple-300">
                        Отчёт: {c.reportBy?.displayName ?? c.reportBy?.nickname ?? "сотрудник"}
                        {c.reportAt ? ` · ${new Date(c.reportAt).toLocaleString("ru-RU")}` : ""}
                      </div>
                      <div className="mt-1 text-[var(--dor-muted)]">{c.reportText}</div>
                    </div>
                  )}
                  {c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE" || c.status === "REPORTED" ? (
                    <div className="mt-2 flex gap-2">
                      {c.status === "REPORTED" && (
                        <>
                          <button
                            type="button"
                            className="dor-btn-primary text-xs"
                            onClick={() => patchCall(c.id, "done")}
                          >
                            Закрыть вызов
                          </button>
                          <button
                            type="button"
                            className="dor-btn-secondary text-xs"
                            onClick={() => patchCall(c.id, "reopen")}
                          >
                            Нужна подмога
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="dor-btn-secondary text-xs"
                        onClick={() => patchCall(c.id, "cancel")}
                      >
                        Отмена
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── База эвакуаций ── */}
        <EvacDatabase />
        <VehicleRegistryPanel />
      </main>
    </div>
  );
}

type EvacRecord = {
  id: string;
  plate: string;
  ownerNickname: string | null;
  violation: string;
  description: string | null;
  status: string;
  photoUrls: string;
  createdAt: string;
  closedAt: string | null;
  user: { nickname: string; displayName: string | null };
};

function EvacDatabase() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<EvacRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  const search = useCallback(async (plate: string) => {
    if (plate.length < 2) { setResults([]); return; }
    setLoading(true);
    const r = await fetch(`/api/evacuations/history?plate=${encodeURIComponent(plate)}`);
    setLoading(false);
    if (!r.ok) return;
    const d = await r.json();
    setResults(d.evacuations ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q.trim().toUpperCase()), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  const STATUS_BADGE: Record<string, string> = {
    CLOSED: "bg-[var(--dor-green)]/15 text-[var(--dor-green-bright)]",
    DELIVERED: "bg-blue-500/15 text-blue-400",
    ACTIVE: "bg-[var(--dor-orange)]/15 text-[var(--dor-orange)]",
    DRAFT: "bg-[var(--dor-border)] text-[var(--dor-muted)]",
  };
  const STATUS_RU: Record<string, string> = {
    CLOSED: "Закрыта",
    DELIVERED: "В пути",
    ACTIVE: "Ведется эвакуация",
    DRAFT: "Черновик",
  };

  return (
    <section className="dor-card p-5">
      <h2 className="font-semibold">🗂 База эвакуаций</h2>
      <p className="mt-1 text-sm text-[var(--dor-muted)]">
        Поиск по номеру ТС. Можно проверить историю нарушений любого авто.
      </p>
      <div className="relative mt-3">
        <input
          className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--dor-orange)]"
          placeholder="Введите номер авто, напр. SA 2048"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {loading && (
          <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-[var(--dor-orange)] border-t-transparent" />
        )}
      </div>

      {results.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--dor-muted)]">Найдено записей: {results.length}</p>
          {results.map((ev) => {
            let photos: string[] = [];
            try { photos = JSON.parse(ev.photoUrls) as string[]; } catch { photos = []; }
            const isOpen = expanded === ev.id;

            return (
              <div key={ev.id} className="rounded-xl border border-[var(--dor-border)] overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-[var(--dor-surface)] transition"
                  onClick={() => setExpanded(isOpen ? null : ev.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{ev.plate}</span>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[ev.status] ?? ""}`}>
                        {STATUS_RU[ev.status] ?? ev.status}
                      </span>
                      {photos.length > 0 && (
                        <span className="text-xs text-[var(--dor-muted)]">📷 {photos.length} фото</span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--dor-muted)]">
                      {ev.violation || "—"}
                    </div>
                    {ev.ownerNickname && (
                      <div className="mt-0.5 truncate text-xs text-[var(--dor-muted)]">
                        Владелец: {ev.ownerNickname}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-[var(--dor-muted)]">
                    <div>{new Date(ev.createdAt).toLocaleDateString("ru-RU")}</div>
                    <div>{ev.user.displayName ?? ev.user.nickname}</div>
                    <div className="mt-0.5 text-[10px]">{isOpen ? "▲" : "▼"}</div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--dor-border)] bg-[var(--dor-night)] p-3">
                    {ev.description && (
                      <p className="mb-2 text-xs italic text-[var(--dor-muted)]">{ev.description}</p>
                    )}
                    {photos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {photos.map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={p}
                            alt={`фото ${i + 1}`}
                            className="h-24 w-36 cursor-zoom-in rounded-lg object-cover border border-[var(--dor-border)] transition hover:brightness-110"
                            onClick={() => setLightbox({ photos, idx: i })}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--dor-muted)]">Фото не прикреплены.</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {ev.closedAt && (
                        <span className="text-xs text-[var(--dor-muted)]">
                          Закрыта: {new Date(ev.closedAt).toLocaleString("ru-RU")}
                        </span>
                      )}
                      <Link
                        href={`/dashboard/dispatch/evacuation/${ev.id}`}
                        className="ml-auto rounded-lg border border-[var(--dor-orange)]/40 bg-[var(--dor-orange)]/10 px-3 py-1 text-xs font-semibold text-[var(--dor-orange)] hover:bg-[var(--dor-orange)]/20 transition"
                      >
                        Открыть полную карточку →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : q.length >= 2 && !loading ? (
        <p className="mt-3 text-sm text-[var(--dor-muted)]">
          По запросу «{q}» эвакуаций не найдено.
        </p>
      ) : null}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

type RegVehicleRow = {
  id: string;
  plate: string;
  model: string | null;
  owner: string | null;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
};

function VehicleRegistryPanel() {
  const [rows, setRows] = useState<RegVehicleRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const rowsRef = useRef<RegVehicleRow[]>([]);
  useLayoutEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  async function fetchRegistry(reset: boolean) {
    setLoading(true);
    const skip = reset ? 0 : rowsRef.current.length;
    const r = await fetch(`/api/vehicles/registry?skip=${skip}&take=20`, { cache: "no-store" });
    setLoading(false);
    if (!r.ok) return;
    const d = await r.json().catch(() => ({}));
    const next: RegVehicleRow[] = d.vehicles ?? [];
    setHasMore(Boolean(d.hasMore));
    if (reset) setRows(next);
    else setRows((prev) => [...prev, ...next]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const r = await fetch(`/api/vehicles/registry?skip=0&take=20`, { cache: "no-store" });
      setLoading(false);
      if (!r.ok || cancelled) return;
      const d = await r.json().catch(() => ({}));
      if (cancelled) return;
      setRows(d.vehicles ?? []);
      setHasMore(Boolean(d.hasMore));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="dor-card p-5">
      <h2 className="font-semibold">🚗 Реестр ТС</h2>
      <p className="mt-1 text-sm text-[var(--dor-muted)]">
        Все записи из базы (патруль и админка). По 20 строк; при необходимости подгружайте дальше.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="dor-btn-secondary text-xs"
          disabled={loading}
          onClick={() => fetchRegistry(true)}
        >
          Обновить с начала
        </button>
      </div>
      {rows.length === 0 && !loading ? (
        <p className="mt-3 text-sm text-[var(--dor-muted)]">Записей нет или ещё не загружено.</p>
      ) : (
        <ul className="mt-3 max-h-[min(70vh,520px)] space-y-2 overflow-y-auto text-sm">
          {rows.map((v) => (
            <li
              key={v.id}
              className="rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)]/50 p-3"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-semibold text-[var(--dor-orange)]">{v.plate}</div>
                  {v.model ? <div className="text-xs text-[var(--dor-muted)]">{v.model}</div> : null}
                  {v.owner ? (
                    <div className="mt-1 text-xs text-[var(--dor-text)]">Владелец: {v.owner}</div>
                  ) : null}
                  {v.notes ? (
                    <div className="mt-1 text-[11px] text-[var(--dor-muted)]">{v.notes}</div>
                  ) : null}
                  <div className="mt-1 text-[10px] text-[var(--dor-muted)]">
                    {new Date(v.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
                {v.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.photoUrl}
                    alt=""
                    className="h-16 w-24 shrink-0 cursor-zoom-in rounded-lg border border-[var(--dor-border)] object-cover"
                    onClick={() => setLightbox({ photos: [v.photoUrl!], idx: 0 })}
                  />
                ) : (
                  <span className="text-[10px] text-[var(--dor-muted)]">нет фото</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <button
          type="button"
          className="mt-3 dor-btn-secondary text-xs disabled:opacity-50"
          disabled={loading}
          onClick={() => fetchRegistry(false)}
        >
          {loading ? "Загрузка…" : "Показать ещё 20"}
        </button>
      ) : rows.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--dor-muted)]">Все записи загружены.</p>
      ) : null}
      {lightbox ? (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.idx}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}
