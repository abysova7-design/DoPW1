"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { MapClient } from "@/components/MapClient";
import type { PositionRank } from "@/lib/positions";
import { compressImage } from "@/lib/compress-image";

type Vehicle = {
  id: string;
  plate: string;
  model: string | null;
  owner: string | null;
  photoUrl: string | null;
  notes: string | null;
};
type Evacuation = {
  id: string;
  plate: string;
  ownerNickname: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  violation: string;
  description: string | null;
  status: string;
  photoUrls: string;
};
type EvacHistory = {
  id: string;
  plate: string;
  violation: string;
  description: string | null;
  photoUrls: string;
  createdAt: string;
  closedAt: string | null;
  user: { nickname: string; displayName: string | null };
};

export default function EvacuationPage() {
  const router = useRouter();
  const STATUS_RU: Record<string, string> = {
    DRAFT: "Черновик",
    ACTIVE: "Ведется эвакуация",
    DELIVERED: "В пути",
    CLOSED: "Закрыта",
  };
  const [evacuation, setEvacuation] = useState<Evacuation | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Vehicle[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [history, setHistory] = useState<EvacHistory[]>([]);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);
  const [headerUser, setHeaderUser] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/evacuations/current");
    if (!r.ok) {
      router.replace("/dashboard");
      return;
    }
    const d = await r.json();
    if (!d.evacuation) {
      router.replace("/dashboard");
      return;
    }
    setEvacuation(d.evacuation);
    setPickedLat(d.evacuation?.pickupLat ?? null);
    setPickedLng(d.evacuation?.pickupLng ?? null);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setHeaderUser({
            isAdmin: d.user.isAdmin,
            positionRank: d.user.positionRank,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      const r = await fetch(`/api/vehicles/search?q=${encodeURIComponent(q)}&take=50`);
      if (!r.ok) return;
      const d = await r.json();
      setHits(d.vehicles ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function fetchHistory(plate: string) {
    if (plate.length < 2) { setHistory([]); return; }
    const r = await fetch(`/api/evacuations/history?plate=${encodeURIComponent(plate)}`);
    if (!r.ok) return;
    const d = await r.json();
    setHistory(d.evacuations ?? []);
  }

  async function applyFromHistory(h: EvacHistory) {
    if (!evacuation) return;
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate: h.plate,
        violation: `[ПОВТОРНОЕ НАРУШЕНИЕ] ${h.violation}`.slice(0, 500),
        description: `Предыдущая эвакуация: ${new Date(h.createdAt).toLocaleDateString("ru-RU")}, сотрудник ${h.user.displayName ?? h.user.nickname}`,
      }),
    });
    setBusy(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); setMsg(e.error ?? "Ошибка"); return; }
    const d = await r.json();
    setEvacuation(d.evacuation);
    setMsg("Данные из истории применены. Это повторное нарушение.");
  }

  async function applyVehicle(v: Vehicle) {
    if (!evacuation) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applyVehicleId: v.id }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "Ошибка");
      return;
    }
    const d = await r.json();
    setEvacuation(d.evacuation);
    setMsg("Данные из базы применены к текущей эвакуации.");
  }

  async function saveFields() {
    if (!evacuation) return;
    setBusy(true);
    setMsg(null);
    const plate = (document.getElementById("ev-plate") as HTMLInputElement)?.value;
    const ownerNickname = (document.getElementById("ev-owner") as HTMLInputElement)?.value;
    const violation = (document.getElementById("ev-violation") as HTMLTextAreaElement)
      ?.value;
    const description = (document.getElementById("ev-desc") as HTMLTextAreaElement)
      ?.value;
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate,
        ownerNickname,
        violation,
        description,
        pickupLat: pickedLat,
        pickupLng: pickedLng,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "Ошибка");
      return;
    }
    const d = await r.json();
    setEvacuation(d.evacuation);
    setMsg("Сохранено.");
  }

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    if (!evacuation || !e.target.files?.length) return;
    setBusy(true);
    setMsg(null);
    const files = Array.from(e.target.files).slice(0, 8); // до 8 фото за раз
    const urls: string[] = [];
    for (const f of files) {
      try {
        const dataUrl = await compressImage(f, 1024, 768, 0.8);
        urls.push(dataUrl);
      } catch {
        setMsg("Не удалось обработать фото: " + f.name);
        setBusy(false);
        return;
      }
    }
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrls: urls }),
    });
    setBusy(false);
    if (!r.ok) {
      setMsg("Не удалось загрузить фото.");
      return;
    }
    const d = await r.json();
    setEvacuation(d.evacuation);
    setMsg("Фото добавлены в тикет.");
    e.target.value = "";
  }

  async function createTicket() {
    if (!evacuation) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createTicket" }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "Не удалось создать тикет");
      return;
    }
    const d = await r.json();
    setEvacuation(d.evacuation);
    setMsg("Тикет создан. На карте диспетчера отмечен активный эвакуатор (синяя точка).");
  }

  async function deliver() {
    if (!evacuation) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deliver" }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "Не удалось отметить доставку");
      return;
    }
    setMsg("Перевозка начата. Статус изменён на «В пути».");
    load();
  }

  async function closeTicket() {
    if (!evacuation) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/evacuations/${evacuation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    setBusy(false);
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setMsg(e.error ?? "Нельзя закрыть");
      return;
    }
    const d = await r.json();
    // После закрытия очищаем форму на клиенте, чтобы сразу начать следующий цикл.
    setEvacuation((prev) =>
      prev
        ? {
            ...d.evacuation,
            plate: "",
            ownerNickname: "",
            violation: "",
            description: "",
            photoUrls: "[]",
            pickupLat: null,
            pickupLng: null,
          }
        : d.evacuation,
    );
    setPickedLat(1794);
    setPickedLng(4151);
    setQ("");
    setHits([]);
    setHistory([]);
    setMsg(`ТС сдано на штрафстоянку. Эвакуация закрыта. +${d.xpGain} XP (уровень ${d.level}, всего XP ${d.xp}).`);
    setTimeout(() => {
      window.location.assign("/dashboard/evacuation");
    }, 5000);
  }

  if (!evacuation) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Загрузка…
      </div>
    );
  }

  let photos: string[] = [];
  try {
    photos = JSON.parse(evacuation.photoUrls) as string[];
  } catch {
    photos = [];
  }
  const isClosed = evacuation.status === "CLOSED";
  const hasRequiredFields = Boolean(evacuation.plate?.trim() && evacuation.violation?.trim());
  const hasPickupPoint = pickedLat != null && pickedLng != null;
  const hasPhotos = photos.length > 0;
  const canCreateTicket = evacuation.status === "DRAFT" && hasRequiredFields && hasPickupPoint;
  const canUploadPhotos = evacuation.status === "ACTIVE" || evacuation.status === "DELIVERED";
  const canDeliver = evacuation.status === "ACTIVE" && hasRequiredFields && hasPhotos && !isClosed;
  const canClose = evacuation.status === "DELIVERED" && hasRequiredFields && hasPhotos;

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader
        authed
        isAdmin={headerUser?.isAdmin}
        positionRank={headerUser?.positionRank}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Панель эвакуации</h1>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            Назад в кабинет
          </Link>
        </div>

        <section className="dor-card p-5">
          <h2 className="font-semibold">Поиск в базе департамента</h2>
          <p className="mt-1 text-sm text-[var(--dor-muted)]">
            По номеру или модели. Если ТС есть — примените карточку к текущей
            эвакуации.
          </p>
          <input
            className="mt-3 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 outline-none focus:border-[var(--dor-orange)]"
            placeholder="Например: SA 2048"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              fetchHistory(e.target.value.trim().toUpperCase());
            }}
          />
          <ul className="mt-3 space-y-2">
            {hits.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dor-border)] p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-medium">{v.plate}</div>
                  {v.owner ? (
                    <div className="text-xs text-[var(--dor-text)]">Владелец: {v.owner}</div>
                  ) : null}
                  <div className="text-sm text-[var(--dor-muted)]">
                    {[v.model, v.notes].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {v.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.photoUrl}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded border border-[var(--dor-border)] object-cover"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  className="dor-btn-primary text-sm"
                  onClick={() => applyVehicle(v)}
                >
                  Применить данные
                </button>
              </li>
            ))}
          </ul>

          {/* История эвакуаций по номеру */}
          {history.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/5 p-3">
              <p className="mb-3 text-sm font-bold text-red-400">
                ⚠️ Повторные нарушения — {history.length} запись(-ей)
              </p>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {history.map((h) => {
                  let photos: string[] = [];
                  try { photos = JSON.parse(h.photoUrls) as string[]; } catch { photos = []; }
                  return (
                    <div key={h.id} className="rounded-xl border border-red-500/20 bg-[var(--dor-night)] overflow-hidden">
                      {photos.length > 0 && (
                        <div className="flex gap-1 overflow-x-auto p-1">
                          {photos.slice(0, 4).map((p, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={p} alt=""
                              className="h-20 w-28 shrink-0 rounded-lg object-cover border border-[var(--dor-border)]"
                            />
                          ))}
                        </div>
                      )}
                      <div className="p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-sm">{h.plate}</span>
                          <span className="text-[var(--dor-muted)]">
                            {new Date(h.createdAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                        <div className="mt-1 text-[var(--dor-muted)]">{h.violation || "—"}</div>
                        {h.description && (
                          <div className="mt-0.5 text-[var(--dor-muted)]/70 italic">{h.description}</div>
                        )}
                        <div className="mt-0.5 text-[var(--dor-muted)]">
                          Сотрудник: {h.user.displayName ?? h.user.nickname}
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          className="mt-2 w-full rounded-lg border border-red-500/40 bg-red-500/10 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition"
                          onClick={() => applyFromHistory(h)}
                        >
                          Применить как повторное нарушение
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="dor-card p-5">
          <h2 className="font-semibold">Тикет эвакуации</h2>
          <p className="text-xs text-[var(--dor-muted)]">
            Статус: <strong>{STATUS_RU[evacuation.status] ?? evacuation.status}</strong>
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Номер</label>
              <input
                id="ev-plate"
                defaultValue={evacuation.plate}
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 font-mono outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Никнейм владельца ТС</label>
              <input
                id="ev-owner"
                defaultValue={evacuation.ownerNickname ?? ""}
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 outline-none"
                placeholder="Например: John_Doe"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Нарушение</label>
              <textarea
                id="ev-violation"
                defaultValue={evacuation.violation}
                rows={3}
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">
                Примечание / RP-описание
              </label>
              <textarea
                id="ev-desc"
                defaultValue={evacuation.description ?? ""}
                rows={2}
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs text-[var(--dor-muted)]">
              Точка эвакуации (клик по карте):{" "}
              {pickedLat != null && pickedLng != null
                ? `${Math.round(pickedLat)}, ${Math.round(pickedLng)}`
                : "не выбрана"}
            </p>
            <MapClient
              heightClass="h-[280px] md:h-[360px]"
              initialLat={evacuation.pickupLat ?? undefined}
              initialLng={evacuation.pickupLng ?? undefined}
              onPick={(lat, lng) => {
                setPickedLat(lat);
                setPickedLng(lng);
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="dor-btn-secondary text-sm"
              onClick={saveFields}
            >
              1) Сохранить
            </button>
            <button
              type="button"
              disabled={busy || !canCreateTicket}
              className="dor-btn-primary text-sm"
              onClick={createTicket}
              title={!canCreateTicket ? "Нужно сохранить поля и отметить точку на карте" : undefined}
            >
              2) Создать тикет
            </button>
            <label className={`dor-btn-primary text-sm ${!canUploadPhotos || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
              3) Загрузить фото
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onPhotos}
                disabled={!canUploadPhotos || busy}
              />
            </label>
            <button
              type="button"
              disabled={busy || !canDeliver}
              className="dor-btn-secondary text-sm"
              onClick={deliver}
              title={!canDeliver ? "Нужно: сохранить данные и добавить минимум одно фото" : undefined}
            >
              4) Старт перевозки
            </button>
            <button
              type="button"
              disabled={busy || !canClose}
              className="dor-btn-primary text-sm"
              onClick={closeTicket}
              title={!canClose ? "Доступно только после шага «Старт перевозки»" : undefined}
            >
              5) Сдал на штрафстоянку
            </button>
          </div>
          {msg ? <p className="mt-3 text-sm text-[var(--dor-muted)]">{msg}</p> : null}

          {photos.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs text-[var(--dor-muted)]">
                Прикреплено фото: {photos.length}
                {photos.length < 12 && (
                  <> · можно добавить ещё {12 - photos.length}</>
                )}
              </p>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p}
                    alt=""
                    className="aspect-video w-full cursor-zoom-in rounded-xl border border-[var(--dor-border)] object-cover transition hover:brightness-110"
                    onClick={() => setLightbox({ photos, idx: i })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--dor-muted)]">
              Фото не прикреплены. Нажмите «Загрузить фото» выше.
            </p>
          )}
        </section>

        {lightbox && (
          <PhotoLightbox
            photos={lightbox.photos}
            startIndex={lightbox.idx}
            onClose={() => setLightbox(null)}
          />
        )}
      </main>
    </div>
  );
}
