"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { MapClient } from "@/components/MapClient";
import type { PositionRank } from "@/lib/positions";
import {
  CIVIC_CATEGORIES,
  CIVIC_CATEGORY_LABELS,
  type CivicCategory,
} from "@/lib/civic-help";

export default function HelpPage() {
  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [authed, setAuthed] = useState(false);
  const [shiftsOnDuty, setShiftsOnDuty] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [category, setCategory] = useState<CivicCategory>("ROADSIDE");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLng, setEndLng] = useState<number | null>(null);
  const [mapPickSlot, setMapPickSlot] = useState<"A" | "B">("A");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mapNonce, setMapNonce] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setAuthed(true);
          setMe({
            isAdmin: d.user.isAdmin,
            positionRank: d.user.positionRank,
          });
        } else {
          setAuthed(false);
          setMe(null);
        }
      })
      .catch(() => setMe(null));
  }, []);

  const loadStats = useCallback(() => {
    fetch("/api/public-assistance?stats=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.shiftsOnDuty === "number") setShiftsOnDuty(d.shiftsOnDuty);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, [loadStats]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (lat == null || lng == null) {
      setMsg("Отметьте точку на карте.");
      return;
    }
    if (category === "LOGISTICS") {
      if (endLat == null || endLng == null) {
        setMsg("Для логистики отметьте точку Б (куда доставить).");
        return;
      }
    }
    setBusy(true);
    const r = await fetch("/api/public-assistance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        category,
        description,
        phone,
        lat,
        lng,
        ...(category === "LOGISTICS" ? { endLat, endLng } : {}),
      }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Ошибка отправки");
      return;
    }
    let okMsg = "Обращение принято. Спасибо!";
    if (category === "LOGISTICS" && d.autoAssigned) {
      okMsg +=
        " Заявка на логистику автоматически назначена ближайшему свободному сотруднику на смене — он получит вызов в кабинете.";
    } else if (category === "LOGISTICS") {
      okMsg +=
        " Диспетчерский центр уведомлён; если свободных сотрудников не было, назначит вручную.";
    } else {
      okMsg += " Диспетчер увидит вызов и свяжется с вами.";
    }
    setMsg(okMsg);
    setFullName("");
    setDescription("");
    setPhone("");
    setLat(null);
    setLng(null);
    setEndLat(null);
    setEndLng(null);
    setMapPickSlot("A");
    setCategory("ROADSIDE");
    setMapNonce((n) => n + 1);
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader
        authed={authed}
        isAdmin={me?.isAdmin}
        positionRank={me?.positionRank ?? null}
      />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="dor-card p-6 md:p-8">
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-[var(--dor-orange)]">
            Помощь
          </p>
          <h1 className="mt-3 text-2xl font-bold md:text-3xl">
            Сломались в пути? Требуется ремонт дома?
          </h1>
          <p className="mt-4 text-[var(--dor-muted)]">
            Вызовите сотрудников DOPW — они с радостью придут на помощь. Заполните
            форму ниже: диспетчер увидит обращение в панели активных вызовов и
            направит специалиста. Категория «Логистика» — две точки на карте (забор и
            доставка); при наличии свободного сотрудника на смене заявка может быть
            назначена автоматически.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="dor-btn-primary"
              onClick={() => {
                setFormOpen(true);
                setMsg(null);
              }}
            >
              Создать вызов
            </button>
            <Link href="/" className="dor-btn-secondary inline-flex items-center">
              На главную
            </Link>
          </div>
        </div>

        {formOpen ? (
          <section className="dor-card p-6 md:p-8">
            <h2 className="text-lg font-semibold">Форма вызова</h2>
            <form className="mt-4 space-y-4" onSubmit={submit}>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">
                  Имя и фамилия
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">
                  Суть обращения
                </label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => {
                    const v = e.target.value as CivicCategory;
                    setCategory(v);
                    if (v !== "LOGISTICS") {
                      setEndLat(null);
                      setEndLng(null);
                    }
                    setMapPickSlot("A");
                  }}
                >
                  {CIVIC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CIVIC_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">
                  Опишите подробнее задачу
                </label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                  maxLength={4000}
                  placeholder="Где вы находитесь, что случилось, что нужно…"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">
                  Номер телефона
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  maxLength={40}
                  placeholder="+7 …"
                />
              </div>
              <div>
                <p className="text-xs text-[var(--dor-muted)]">
                  {category === "LOGISTICS"
                    ? "Отметьте точку А (забор груза) и точку Б (куда доставить). Переключайте режим кнопками под картой."
                    : "Укажите точку на карте — так бригада быстрее вас найдёт."}
                </p>
                {category === "LOGISTICS" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        mapPickSlot === "A"
                          ? "bg-[var(--dor-orange)] text-black"
                          : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                      }`}
                      onClick={() => setMapPickSlot("A")}
                    >
                      Режим: точка А (забор)
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        mapPickSlot === "B"
                          ? "bg-green-600 text-white"
                          : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                      }`}
                      onClick={() => setMapPickSlot("B")}
                    >
                      Режим: точка Б (доставка)
                    </button>
                  </div>
                ) : null}
                <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--dor-border)]">
                  <MapClient
                    key={`${mapNonce}-${category}`}
                    heightClass="h-[320px] md:h-[380px]"
                    dualPick={category === "LOGISTICS"}
                    pickSlot={mapPickSlot}
                    pointA={lat != null && lng != null ? { lat, lng } : null}
                    pointB={endLat != null && endLng != null ? { lat: endLat, lng: endLng } : null}
                    onPick={(la, ln) => {
                      if (category === "LOGISTICS") {
                        if (mapPickSlot === "A") {
                          setLat(la);
                          setLng(ln);
                        } else {
                          setEndLat(la);
                          setEndLng(ln);
                        }
                      } else {
                        setLat(la);
                        setLng(ln);
                      }
                    }}
                    initialLat={category === "LOGISTICS" ? undefined : lat ?? undefined}
                    initialLng={category === "LOGISTICS" ? undefined : lng ?? undefined}
                  />
                </div>
                {category !== "LOGISTICS" && lat != null && lng != null ? (
                  <p className="mt-2 text-xs text-[var(--dor-muted)]">
                    Координаты: {lat.toFixed(0)}, {lng.toFixed(0)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="dor-btn-primary disabled:opacity-50"
                >
                  Отправить вызов
                </button>
                <button
                  type="button"
                  className="dor-btn-secondary"
                  onClick={() => setFormOpen(false)}
                >
                  Свернуть
                </button>
              </div>
              {msg ? <p className="text-sm text-[var(--dor-muted)]">{msg}</p> : null}
            </form>
          </section>
        ) : null}

        <footer className="dor-card p-5 text-center text-sm text-[var(--dor-muted)]">
          Сотрудников на смене:{" "}
          <span className="font-semibold text-[var(--dor-text)]">
            {shiftsOnDuty == null ? "…" : shiftsOnDuty}
          </span>
        </footer>
      </main>
    </div>
  );
}
