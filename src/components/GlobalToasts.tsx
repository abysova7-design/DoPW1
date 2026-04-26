"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sounds";
import { safeJson } from "@/lib/safe-fetch";

type N = { id: string; title: string; body: string; type: string; read: boolean };
type DispatchCall = {
  id: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  CALL_BASE: "📣",
  BROADCAST: "📢",
  DISPATCH: "📡",
  TASK_ASSIGNED: "📋",
  SYSTEM: "🔔",
  JOB_APPLICATION: "🧾",
  CIVIC_HELP: "🆘",
};

const TYPE_COLOR: Record<string, string> = {
  CALL_BASE: "#e85d04",
  BROADCAST: "#e85d04",
  DISPATCH: "#e85d04",
  TASK_ASSIGNED: "#40916c",
  SYSTEM: "#30363d",
  JOB_APPLICATION: "#a855f7",
  CIVIC_HELP: "#f59e0b",
};

export function GlobalToasts() {
  const [toasts, setToasts] = useState<(N & { key: number })[]>([]);
  const prevUnreadIds = useRef<Set<string>>(new Set());
  const prevDispatchIds = useRef<Set<string>>(new Set());
  const counter = useRef(0);

  const dismiss = useCallback((key: number) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const poll = useCallback(async () => {
    // Не опрашиваем, если нет сессии
    const r = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d = await safeJson<{
      notifications?: N[];
    }>(r, {});
    const items: N[] = d.notifications ?? [];
    const unread = items.filter((n) => !n.read);

    const newOnes = unread.filter((n) => !prevUnreadIds.current.has(n.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((n) => prevUnreadIds.current.add(n.id));

    // Приоритеты: вызовы → собес (sobes) → экзамен → остальное
    const hasCall = newOnes.some(
      (n) =>
        n.type === "DISPATCH" ||
        n.type === "CALL_BASE" ||
        n.type === "BROADCAST" ||
        n.type === "CIVIC_HELP",
    );
    const hasInterview =
      !hasCall && newOnes.some((n) => n.type === "JOB_APPLICATION");
    const hasExam =
      !hasCall && !hasInterview && newOnes.some((n) => n.type === "TASK_ASSIGNED");
    playSound(
      hasCall ? "dispatch" : hasInterview ? "interview" : hasExam ? "exam" : "notification",
    );

    const added = newOnes.map((n) => ({
      ...n,
      key: ++counter.current,
    }));
    setToasts((prev) => [...prev, ...added].slice(-5));

    // Авто-скрытие через 6 сек
    added.forEach(({ key }) => {
      setTimeout(() => dismiss(key), 6000);
    });
  }, [dismiss]);

  const pollDispatch = useCallback(async () => {
    const r = await fetch("/api/dispatch", { cache: "no-store" }).catch(() => null);
    if (!r?.ok) return;
    const d = await safeJson<{ calls?: DispatchCall[] }>(r, {});
    const calls = (d.calls ?? []).filter((c) =>
      c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE" || c.status === "REPORTED",
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dopw:dispatch-updated", { detail: { calls } }));
    }
    const newCalls = calls.filter((c) => !prevDispatchIds.current.has(c.id));
    if (newCalls.length > 0 && prevDispatchIds.current.size > 0) {
      playSound("dispatch");
    }
    calls.forEach((c) => prevDispatchIds.current.add(c.id));
  }, []);

  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => safeJson<{ notifications?: N[] }>(r, {}))
      .then((d) => {
        const items: N[] = d.notifications ?? [];
        items.forEach((n) => prevUnreadIds.current.add(n.id));
      })
      .catch(() => {});
    fetch("/api/dispatch", { cache: "no-store" })
      .then((r) => safeJson<{ calls?: DispatchCall[] }>(r, {}))
      .then((d) => {
        const calls = (d.calls ?? []).filter((c) =>
          c.status === "OPEN" || c.status === "ACCEPTED" || c.status === "ONSITE" || c.status === "REPORTED",
        );
        calls.forEach((c) => prevDispatchIds.current.add(c.id));
      })
      .catch(() => {});

    const t1 = setInterval(poll, 7000);
    const t2 = setInterval(pollDispatch, 5000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, [poll, pollDispatch]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: "0.5rem",
        maxWidth: "calc(100vw - 3rem)",
        width: "340px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          style={{
            background: "var(--dor-night, #0d1117)",
            border: `1px solid ${TYPE_COLOR[t.type] ?? "var(--dor-border)"}`,
            borderRadius: "1rem",
            padding: "12px 14px",
            boxShadow: "0 8px 32px rgba(0,0,0,.6)",
            pointerEvents: "all",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            animation: "toast-in 0.25s ease",
          }}
        >
          <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>
            {TYPE_ICON[t.type] ?? "🔔"}
          </span>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--dor-text, #e6edf3)" }}>
              {t.title}
            </div>
            <div style={{ fontSize: "12px", color: "var(--dor-muted, #8b949e)", marginTop: "2px" }}>
              {t.body}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.key)}
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              color: "var(--dor-muted, #8b949e)",
              fontSize: "14px",
              cursor: "pointer",
              padding: "0 2px",
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
