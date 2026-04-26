"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function LoginPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, code }),
    });
    setLoading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? "Ошибка входа");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed={false} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
        <div className="dor-card p-8">
          <h1 className="text-2xl font-bold">Вход для сотрудников</h1>
          <p className="mt-2 text-sm text-[var(--dor-muted)]">
            Используйте игровой ник и уникальный код, выданный администратором
            портала.
          </p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Никнейм</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2.5 outline-none focus:border-[var(--dor-orange)]"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Секретный код</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2.5 outline-none focus:border-[var(--dor-orange)]"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {err ? (
              <p className="text-sm text-red-400" role="alert">
                {err}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="dor-btn-primary w-full disabled:opacity-50"
            >
              {loading ? "Входим…" : "Войти"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--dor-muted)]">
            <Link href="/" className="text-[var(--dor-orange)] hover:underline">
              На главную
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
