"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { DispatchMapClient } from "@/components/DispatchMapClient";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import type { PositionRank } from "@/lib/positions";
import { RANK_LABELS } from "@/lib/positions";

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
};

type Call = {
  id: string;
  title: string;
  body: string;
  status: string;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  creator: { nickname: string; displayName: string | null };
  target: { nickname: string; displayName: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Открыт",
  ACCEPTED: "Принят",
  DONE: "Выполнен",
  CANCELLED: "Отменён",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "text-[var(--dor-orange)]",
  ACCEPTED: "text-[var(--dor-green-bright)]",
  DONE: "text-[var(--dor-muted)]",
  CANCELLED: "text-red-400",
};

export default function DispatchPage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    isAdmin: boolean;
    isDispatcher: boolean;
    positionRank: PositionRank;
    nickname: string;
  } | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);

  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [targetId, setTargetId] = useState("");
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    if (!d.user) { router.replace("/login"); return; }
    if (!d.user.isDispatcher && !d.user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    setMe(d.user);

    const w = await fetch("/api/dispatch/workers");
    const wd = await w.json();
    setWorkers(wd.workers ?? []);

    const c = await fetch("/api/dispatch");
    const cd = await c.json();
    setCalls(cd.calls ?? []);
  }, [router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

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
      };
    });
  const activeEvacuations = workers.filter((w) => w.activeEvacuation);
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
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            ← Кабинет
          </Link>
        </div>

        <section className="dor-card p-5">
          <h2 className="font-semibold">Карта — расположение сотрудников</h2>
          <p className="mt-1 text-xs text-[var(--dor-muted)]">
            Оранжевые точки — сотрудники с активной сменой (данные с последнего чек-ина).
            Кликните по карте, чтобы отметить точку вызова.
          </p>
          <div className="mt-3">
            <DispatchMapClient
              workers={workerMarkers}
              onPick={(a, b) => { setPickedLat(a); setPickedLng(b); }}
              pickedLat={pickedLat}
              pickedLng={pickedLng}
            />
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
                  {c.status === "OPEN" || c.status === "ACCEPTED" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="dor-btn-primary text-xs"
                        onClick={() => patchCall(c.id, "done")}
                      >
                        Выполнен
                      </button>
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
