"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { RANK_LABELS, type PositionRank } from "@/lib/positions";

function LogoImg() {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onErr = () => {
      el.src = "/logo.svg";
    };
    el.addEventListener("error", onErr, { once: true });
    return () => el.removeEventListener("error", onErr);
  }, []);
  return (
    <img
      ref={ref}
      src="/logo.png"
      alt="ДОР"
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
    />
  );
}

export function SiteHeader({
  authed,
  isAdmin,
  positionRank,
}: {
  authed: boolean;
  isAdmin?: boolean;
  positionRank?: PositionRank | null;
}) {
  void isAdmin;
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--dor-border)] bg-[var(--dor-night)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-[var(--dor-surface)]">
            <LogoImg />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-[var(--dor-orange)]">
              DoPW
            </div>
            <div className="text-xs text-[var(--dor-muted)]">
              Департамент общественных работ
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {authed && positionRank ? (
            <span
              className="hidden max-w-[10rem] truncate rounded-lg bg-[var(--dor-surface)] px-2 py-1 text-xs text-[var(--dor-muted)] md:inline"
              title={RANK_LABELS[positionRank]}
            >
              {RANK_LABELS[positionRank]}
            </span>
          ) : null}
          <Link
            href="/#about"
            className="rounded-lg px-3 py-2 text-[var(--dor-muted)] hover:bg-[var(--dor-surface)] hover:text-[var(--dor-text)]"
          >
            О департаменте
          </Link>
          <Link
            href="/#structure"
            className="rounded-lg px-3 py-2 text-[var(--dor-muted)] hover:bg-[var(--dor-surface)] hover:text-[var(--dor-text)]"
          >
            Структура
          </Link>
          <Link
            href="/#careers"
            className="rounded-lg px-3 py-2 text-[var(--dor-muted)] hover:bg-[var(--dor-surface)] hover:text-[var(--dor-text)]"
          >
            Соискателям
          </Link>
          <Link
            href="/#gallery"
            className="rounded-lg px-3 py-2 text-[var(--dor-muted)] hover:bg-[var(--dor-surface)] hover:text-[var(--dor-text)]"
          >
            Фото
          </Link>
          {authed ? (
            <>
              <Link href="/dashboard" className="dor-btn-primary px-3 py-2 text-sm">
                Личный кабинет
              </Link>
            </>
          ) : (
            <Link href="/login" className="dor-btn-primary px-3 py-2 text-sm">
              Вход для сотрудников
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
