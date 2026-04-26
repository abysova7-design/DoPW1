"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { PositionRank } from "@/lib/positions";

type Post = {
  id: string;
  title: string;
  body: string;
  emoji: string | null;
  createdAt: string;
  author: { nickname: string; displayName: string | null } | null;
};

type Channel = {
  id: string;
  slug: string;
  title: string;
  posts: Post[];
};

const CHANNELS = [
  { slug: "orders",       label: "📋 Приказы" },
  { slug: "attestations", label: "🎓 Аттестации" },
];

export default function ChannelsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{ isAdmin: boolean; positionRank: PositionRank } | null>(null);
  const [activeSlug, setActiveSlug] = useState("orders");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMe = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    if (!d.user) { router.replace("/login"); return; }
    setMe(d.user);
  }, [router]);

  const loadChannel = useCallback(async (slug: string) => {
    setLoading(true);
    const r = await fetch(`/api/channels/${slug}`);
    setLoading(false);
    if (!r.ok) return;
    const d = await r.json();
    setChannel(d.channel);
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);
  useEffect(() => { loadChannel(activeSlug); }, [loadChannel, activeSlug]);

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me?.isAdmin} positionRank={me?.positionRank} />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">📡 Каналы департамента</h1>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              Приказы и результаты аттестаций обновляются автоматически
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">← Кабинет</Link>
        </div>

        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="flex w-full shrink-0 flex-row gap-2 md:w-48 md:flex-col">
            {CHANNELS.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setActiveSlug(c.slug)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  activeSlug === c.slug
                    ? "bg-[var(--dor-orange)] text-black"
                    : "border border-[var(--dor-border)] bg-[var(--dor-surface)] text-[var(--dor-muted)] hover:bg-[var(--dor-border)]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </aside>

          <section className="flex-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="dor-card h-24 animate-pulse" />
                ))}
              </div>
            ) : channel?.posts.length === 0 ? (
              <div className="dor-card p-6 text-center text-[var(--dor-muted)]">
                В этом канале пока нет записей.
              </div>
            ) : (
              <div className="space-y-3">
                {(channel?.posts ?? []).map((p) => (
                  <article
                    key={p.id}
                    className="dor-card overflow-hidden p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {p.emoji ? (
                          <span className="text-2xl leading-tight">{p.emoji}</span>
                        ) : null}
                        <div>
                          <div className="font-semibold leading-snug">{p.title}</div>
                          <div className="mt-0.5 text-xs text-[var(--dor-muted)]">
                            {p.author
                              ? (p.author.displayName ?? p.author.nickname)
                              : "Система"}{" "}
                            · {new Date(p.createdAt).toLocaleString("ru-RU")}
                          </div>
                        </div>
                      </div>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--dor-muted)]">
                      {p.body}
                    </pre>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
