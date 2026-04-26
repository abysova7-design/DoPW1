"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playSound } from "@/lib/sounds";
import { safeJson } from "@/lib/safe-fetch";

type N = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  CALL_BASE: "📣",
  BROADCAST: "📢",
  DISPATCH: "📡",
  TASK_ASSIGNED: "📋",
  SYSTEM: "🔔",
  JOB_APPLICATION: "🧾",
};

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const prevUnread = useRef(0);
  const knownNotifIds = useRef<Set<string>>(new Set());
  const soundInitialized = useRef(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    const r = await fetch("/api/notifications");
    if (!r.ok) return;
    const d = await safeJson<{ notifications?: N[] }>(r, {});
    const next: N[] = d.notifications ?? [];

    if (!soundInitialized.current) {
      next.forEach((n) => knownNotifIds.current.add(n.id));
      soundInitialized.current = true;
    } else {
      const justArrived = next.filter((n) => !knownNotifIds.current.has(n.id));
      justArrived.forEach((n) => knownNotifIds.current.add(n.id));
      const unreadNew = justArrived.filter((n) => !n.read);
      if (unreadNew.length > 0) {
        const hasCall = unreadNew.some(
          (n) =>
            n.type === "DISPATCH" || n.type === "CALL_BASE" || n.type === "BROADCAST",
        );
        const hasInterview = unreadNew.some((n) => n.type === "JOB_APPLICATION");
        const hasExam = unreadNew.some((n) => n.type === "TASK_ASSIGNED");
        playSound(
          hasCall
            ? "dispatch"
            : hasInterview
              ? "interview"
              : hasExam
                ? "exam"
                : "notification",
        );
      }
    }

    const nextUnread = next.filter((x) => !x.read).length;
    prevUnread.current = nextUnread;
    setItems(next);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  // Закрыть при клике вне
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.closest("[data-notif-root]")?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const rightGap = window.innerWidth - rect.right;
      setDropStyle({
        position: "fixed",
        top: rect.bottom + 8,
        right: Math.max(8, rightGap),
        width: Math.min(400, window.innerWidth - 32),
        zIndex: 2147483647, // максимально возможный z-index
      });
    }
    setOpen((v) => !v);
  }

  const unread = items.filter((x) => !x.read).length;

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "readAll" }),
    });
    load();
  }

  async function markOne(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    prevUnread.current = Math.max(0, prevUnread.current - 1);
  }

  const dropdown = (
    <div
      data-notif-root=""
      style={{
        ...dropStyle,
        background: "var(--dor-night, #0d1117)",
        border: "1px solid var(--dor-border, #30363d)",
        borderRadius: "1rem",
        padding: "12px",
        boxShadow: "0 16px 48px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--dor-text, #e6edf3)" }}>
          Уведомления {unread > 0 && <span style={{ color: "var(--dor-orange, #e85d04)" }}>({unread})</span>}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              style={{ fontSize: 12, color: "var(--dor-orange, #e85d04)", background: "none", border: "none", cursor: "pointer" }}
            >
              Прочитать все
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ fontSize: 13, color: "var(--dor-muted, #8b949e)", background: "none", border: "none", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.length === 0 ? (
          <p style={{ textAlign: "center", padding: "16px 0", fontSize: 13, color: "var(--dor-muted, #8b949e)" }}>
            Нет уведомлений
          </p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markOne(n.id)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px",
                borderRadius: "0.75rem",
                border: `1px solid ${n.read ? "var(--dor-border, #30363d)" : "rgba(232,93,4,.45)"}`,
                background: n.read ? "transparent" : "rgba(232,93,4,.05)",
                cursor: "pointer",
                textAlign: "left",
                opacity: n.read ? 0.65 : 1,
                transition: "background .15s",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--dor-text, #e6edf3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.title}
                  </span>
                  {!n.read && (
                    <span style={{ width: 7, height: 7, borderRadius: "999px", background: "var(--dor-orange, #e85d04)", flexShrink: 0 }} />
                  )}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--dor-muted, #8b949e)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {n.body}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 10, color: "rgba(139,148,158,.6)" }}>
                  {new Date(n.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div data-notif-root="" style={{ position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="dor-btn-secondary relative px-3 py-2 text-sm"
      >
        🔔
        {unread > 0 && (
          <span
            style={{
              position: "absolute", top: -4, right: -4,
              minWidth: 18, height: 18, borderRadius: 999,
              background: "var(--dor-orange, #e85d04)",
              color: "#000", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Portal — рендерится прямо в body, минуя все stacking context */}
      {mounted && open && createPortal(dropdown, document.body)}
    </div>
  );
}
