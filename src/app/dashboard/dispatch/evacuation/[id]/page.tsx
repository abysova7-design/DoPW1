"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { RANK_LABELS, type PositionRank } from "@/lib/positions";

const STATUS_RU: Record<string, string> = {
  DRAFT: "Черновик",
  ACTIVE: "Активна",
  DELIVERED: "На штрафстоянке",
  CLOSED: "Закрыта",
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#8b949e",
  ACTIVE: "#e85d04",
  DELIVERED: "#60a5fa",
  CLOSED: "#40916c",
};

type Evac = {
  id: string;
  plate: string;
  violation: string;
  description: string | null;
  status: string;
  photoUrls: string;
  createdAt: string;
  closedAt: string | null;
  user: { nickname: string; displayName: string | null; positionRank: PositionRank };
};

export default function EvacDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [evac, setEvac] = useState<Evac | null>(null);
  const [me, setMe] = useState<{ isAdmin: boolean; positionRank: PositionRank } | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; idx: number } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.replace("/login"); return; }
      setMe(d.user);
    });
    fetch(`/api/evacuations/detail?id=${id}`).then(r => r.json()).then(d => {
      if (d.evac) setEvac(d.evac);
    });
  }, [id, router]);

  if (!evac || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Загрузка…
      </div>
    );
  }

  let photos: string[] = [];
  try { photos = JSON.parse(evac.photoUrls) as string[]; } catch { photos = []; }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--dor-muted)] uppercase tracking-widest">
              Карточка эвакуации
            </p>
            <h1 className="mt-1 font-mono text-3xl font-bold">{evac.plate}</h1>
          </div>
          <div className="flex gap-2">
            <span
              className="rounded-xl px-3 py-1.5 text-sm font-bold"
              style={{ background: `${STATUS_COLOR[evac.status]}20`, color: STATUS_COLOR[evac.status] }}
            >
              {STATUS_RU[evac.status] ?? evac.status}
            </span>
            <Link href="/dashboard/dispatch" className="dor-btn-secondary text-sm">
              ← Диспетчер
            </Link>
          </div>
        </div>

        {/* Основная информация */}
        <section className="dor-card divide-y divide-[var(--dor-border)] overflow-hidden">
          {[
            ["Сотрудник", `${evac.user.displayName ?? evac.user.nickname} · ${RANK_LABELS[evac.user.positionRank]}`],
            ["Нарушение", evac.violation || "—"],
            ["Описание / RP", evac.description || "—"],
            ["Создана", new Date(evac.createdAt).toLocaleString("ru-RU")],
            ["Закрыта", evac.closedAt ? new Date(evac.closedAt).toLocaleString("ru-RU") : "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-4 px-5 py-3">
              <span className="w-36 shrink-0 text-xs font-medium text-[var(--dor-muted)]">{label}</span>
              <span className="text-sm">{value}</span>
            </div>
          ))}
        </section>

        {/* Фотоматериалы */}
        <section className="dor-card p-5">
          <h2 className="mb-3 font-semibold">
            📷 Фотоматериалы{photos.length > 0 ? ` (${photos.length})` : ""}
          </h2>
          {photos.length === 0 ? (
            <p className="text-sm text-[var(--dor-muted)]">Фото не прикреплено.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p}
                  alt={`фото ${i + 1}`}
                  className="aspect-video w-full cursor-zoom-in rounded-xl border border-[var(--dor-border)] object-cover transition hover:brightness-110"
                  onClick={() => setLightbox({ photos, idx: i })}
                />
              ))}
            </div>
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
