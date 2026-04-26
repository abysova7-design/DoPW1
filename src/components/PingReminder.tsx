"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapClient } from "./MapClient";
import { playSound } from "@/lib/sounds";

const INTERVAL_MS = 10 * 60 * 1000;

export function PingReminder() {
  const [last, setLast] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [savedLat, setSavedLat] = useState<number | null>(null);
  const [savedLng, setSavedLng] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const alertedRef = useRef(false); // чтобы не играть звук повторно до следующей отметки

  const load = useCallback(async () => {
    const r = await fetch("/api/pings");
    if (!r.ok) return;
    const d = await r.json();
    if (d.last?.createdAt) {
      setLast(new Date(d.last.createdAt));
      // Восстанавливаем последнюю сохранённую точку на карте
      setSavedLat(d.last.lat ?? null);
      setSavedLng(d.last.lng ?? null);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [load]);

  // Звук: проигрываем 10minalert.mp3 в момент когда пора обновить точку
  useEffect(() => {
    if (!last) return;
    const elapsed = now.getTime() - last.getTime();
    const isOverdue = elapsed >= INTERVAL_MS;
    if (isOverdue && !alertedRef.current) {
      alertedRef.current = true;
      playSound("ping");
    }
    if (!isOverdue) {
      alertedRef.current = false; // сбрасываем флаг после успешной отметки
    }
  }, [now, last]);

  const overdue = !last || now.getTime() - last.getTime() > INTERVAL_MS;
  const etaMs = last ? Math.max(0, INTERVAL_MS - (now.getTime() - last.getTime())) : 0;

  // Отображаем либо выбранную точку, либо последнюю сохранённую
  const displayLat = lat ?? savedLat;
  const displayLng = lng ?? savedLng;

  async function submitPing() {
    setStatus(null);
    const sendLat = lat ?? savedLat;
    const sendLng = lng ?? savedLng;
    if (sendLat == null || sendLng == null) {
      setStatus("Отметьте точку на карте кликом.");
      return;
    }
    const r = await fetch("/api/pings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: sendLat, lng: sendLng, label: "Чек-ин смены" }),
    });
    if (!r.ok) { setStatus("Не удалось отправить."); return; }
    setStatus("✅ Отметка сохранена.");
    setSavedLat(sendLat);
    setSavedLng(sendLng);
    setLat(null);
    setLng(null);
    alertedRef.current = false; // после отметки разрешаем снова сыграть через 10 мин
    load();
  }

  return (
    <section className="dor-card p-5">
      <h2 className="text-lg font-semibold">📍 Контроль присутствия на карте</h2>
      <p className="mt-1 text-sm text-[var(--dor-muted)]">
        Раз в ~10 минут отметьте своё положение кликом по карте.
      </p>

      <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${
        overdue
          ? "border border-[var(--dor-orange)]/50 bg-[var(--dor-orange)]/10"
          : "border border-[var(--dor-green)]/40 bg-[var(--dor-green)]/10"
      }`}>
        {last ? (
          <>
            Последняя отметка: <strong>{last.toLocaleString("ru-RU")}</strong>
            {!overdue ? (
              <> · след. через{" "}
                <strong>
                  {Math.ceil(etaMs / 60000)}:{String(Math.floor((etaMs % 60000) / 1000)).padStart(2, "0")}
                </strong>
              </>
            ) : (
              <> · <span className="text-[var(--dor-orange)]">нужно обновить точку</span></>
            )}
          </>
        ) : (
          <>Отметок ещё не было — кликните на карту и нажмите «Отправить».</>
        )}
      </div>

      <div className="mt-4">
        <MapClient
          onPick={(a, b) => { setLat(a); setLng(b); }}
          initialLat={displayLat ?? undefined}
          initialLng={displayLng ?? undefined}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="dor-btn-primary text-sm" onClick={submitPing}>
          Отправить отметку
        </button>
        {displayLat != null && (
          <span className="text-xs text-[var(--dor-muted)]">
            {lat != null ? "Новая" : "Сохранённая"} точка: {Math.round(displayLat)}, {Math.round(displayLng ?? 0)}
          </span>
        )}
      </div>
      {status && <p className="mt-2 text-sm text-[var(--dor-muted)]">{status}</p>}
    </section>
  );
}
