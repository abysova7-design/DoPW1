"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RANK_LABELS, type PositionRank } from "@/lib/positions";

function LogoImg({ className = "h-9 w-9 sm:h-10 sm:w-10" }: { className?: string }) {
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
      className={`object-contain ${className}`}
    />
  );
}

const DESKTOP_LINK =
  "rounded-lg px-3 py-2 text-[var(--dor-muted)] hover:bg-[var(--dor-surface)] hover:text-[var(--dor-text)]";

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--dor-border)] bg-[var(--dor-night)]/95 backdrop-blur">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[45] bg-black/55 md:hidden"
          aria-label="Закрыть меню"
          onClick={closeMenu}
        />
      ) : null}

      <div className="relative z-[60] mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
          onClick={closeMenu}
        >
          <div className="relative shrink-0 overflow-hidden rounded-lg bg-[var(--dor-surface)]">
            <LogoImg />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-semibold tracking-wide text-[var(--dor-orange)]">
              DoPW
            </div>
            <div className="hidden text-xs text-[var(--dor-muted)] sm:block">
              Департамент общественных работ
            </div>
            <div className="max-w-[11rem] truncate text-[11px] leading-snug text-[var(--dor-muted)] sm:hidden">
              Департамент ОР
            </div>
          </div>
        </Link>

        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--dor-border)] bg-[var(--dor-surface)] text-[var(--dor-text)] md:hidden"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-nav"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        <nav
          className="hidden flex-wrap items-center gap-1 text-sm md:flex md:gap-2"
          aria-label="Основная навигация"
        >
          {authed && positionRank ? (
            <span
              className="hidden max-w-[10rem] truncate rounded-lg bg-[var(--dor-surface)] px-2 py-1 text-xs text-[var(--dor-muted)] md:inline"
              title={RANK_LABELS[positionRank]}
            >
              {RANK_LABELS[positionRank]}
            </span>
          ) : null}
          <Link href="/#about" className={DESKTOP_LINK}>
            О департаменте
          </Link>
          <Link href="/help" className={DESKTOP_LINK}>
            Помощь
          </Link>
          <Link href="/#structure" className={DESKTOP_LINK}>
            Структура
          </Link>
          <Link href="/#careers" className={DESKTOP_LINK}>
            Соискателям
          </Link>
          <Link href="/#gallery" className={DESKTOP_LINK}>
            Фото
          </Link>
          {authed ? (
            <Link href="/dashboard" className="dor-btn-primary px-3 py-2 text-sm">
              Личный кабинет
            </Link>
          ) : (
            <Link href="/login" className="dor-btn-primary px-3 py-2 text-sm">
              Вход для сотрудников
            </Link>
          )}
        </nav>
      </div>

      <nav
        id="site-mobile-nav"
        className={`relative z-[60] border-t border-[var(--dor-border)] bg-[var(--dor-night)] md:hidden ${
          menuOpen ? "block" : "hidden"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="mx-auto max-w-6xl space-y-1 px-3 py-3 sm:px-4">
          {authed && positionRank ? (
            <div className="mb-2 rounded-xl bg-[var(--dor-surface)] px-4 py-2.5 text-sm text-[var(--dor-muted)]">
              <span className="text-xs uppercase tracking-wide text-[var(--dor-orange)]">
                Должность
              </span>
              <div className="mt-0.5 font-medium text-[var(--dor-text)]">
                {RANK_LABELS[positionRank]}
              </div>
            </div>
          ) : null}

          <Link
            href="/#about"
            className="block rounded-xl px-4 py-3.5 text-base text-[var(--dor-text)] hover:bg-[var(--dor-surface)] active:bg-[var(--dor-surface)]"
            onClick={closeMenu}
          >
            О департаменте
          </Link>
          <Link
            href="/help"
            className="block rounded-xl px-4 py-3.5 text-base text-[var(--dor-text)] hover:bg-[var(--dor-surface)] active:bg-[var(--dor-surface)]"
            onClick={closeMenu}
          >
            Помощь
          </Link>
          <Link
            href="/#structure"
            className="block rounded-xl px-4 py-3.5 text-base text-[var(--dor-text)] hover:bg-[var(--dor-surface)] active:bg-[var(--dor-surface)]"
            onClick={closeMenu}
          >
            Структура
          </Link>
          <Link
            href="/#careers"
            className="block rounded-xl px-4 py-3.5 text-base text-[var(--dor-text)] hover:bg-[var(--dor-surface)] active:bg-[var(--dor-surface)]"
            onClick={closeMenu}
          >
            Соискателям
          </Link>
          <Link
            href="/#gallery"
            className="block rounded-xl px-4 py-3.5 text-base text-[var(--dor-text)] hover:bg-[var(--dor-surface)] active:bg-[var(--dor-surface)]"
            onClick={closeMenu}
          >
            Фото
          </Link>

          <div className="pt-2">
            {authed ? (
              <Link
                href="/dashboard"
                className="dor-btn-primary flex w-full justify-center py-3.5 text-base"
                onClick={closeMenu}
              >
                Личный кабинет
              </Link>
            ) : (
              <Link
                href="/login"
                className="dor-btn-primary flex w-full justify-center py-3.5 text-base"
                onClick={closeMenu}
              >
                Вход для сотрудников
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
