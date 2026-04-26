"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { NotificationsBell } from "@/components/NotificationsBell";
import { canManageJobApplications, type PositionRank } from "@/lib/positions";
import { safeJson } from "@/lib/safe-fetch";

type AppRow = {
  id: string;
  nickname: string;
  gameLevel: string;
  drugAddict: boolean;
  phone: string;
  engineeringEdu: boolean;
  educationLevel: string | null;
  driverLicense: boolean;
  licenseCategory: string | null;
  interviewAt: string;
  expectedIncome: number;
  createdAt: string;
};

export default function JobApplicationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [list, setList] = useState<AppRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rme = await fetch("/api/auth/me");
    const dme = await safeJson<{
      user: {
        isAdmin: boolean;
        positionRank: PositionRank;
      } | null;
    }>(rme, { user: null });
    if (!dme.user) {
      router.replace("/login");
      return;
    }
    setMe(dme.user);
    if (!canManageJobApplications(dme.user.positionRank, dme.user.isAdmin)) {
      setErr("Раздел только для заместителей, директора и администраторов.");
      return;
    }
    const r = await fetch("/api/job-applications");
    const d = await safeJson<{ applications?: AppRow[]; error?: string }>(r, {});
    if (!r.ok) {
      setErr(d.error ?? "Ошибка загрузки");
      return;
    }
    setList(d.applications ?? []);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Загрузка…
      </div>
    );
  }

  if (!canManageJobApplications(me.positionRank, me.isAdmin)) {
    return (
      <div className="dor-stripes min-h-screen">
        <SiteHeader authed positionRank={me.positionRank} isAdmin={me.isAdmin} />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-[var(--dor-muted)]">{err}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-[var(--dor-orange)] hover:underline">
            ← В личный кабинет
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed positionRank={me.positionRank} isAdmin={me.isAdmin} />
      <div className="border-b border-[var(--dor-border)] bg-[var(--dor-surface)]/30">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 py-2">
          <NotificationsBell />
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-[var(--dor-orange)] hover:underline"
          >
            ← Личный кабинет
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Заявки на собеседование</h1>
          <p className="mt-1 text-sm text-[var(--dor-muted)]">
            Данные публичной формы с главной страницы. Свяжитесь с кандидатом по
            телефону или в игре.
          </p>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        {list.length === 0 && !err ? (
          <p className="text-sm text-[var(--dor-muted)]">Пока нет заявок.</p>
        ) : (
          <ul className="space-y-4">
            {list.map((a) => (
              <li
                key={a.id}
                className="dor-card p-4 text-sm leading-relaxed"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-base">{a.nickname}</span>
                  <span className="text-xs text-[var(--dor-muted)]">
                    {new Date(a.createdAt).toLocaleString("ru-RU")}
                  </span>
                </div>
                <div className="mt-2 grid gap-1 text-[var(--dor-muted)] md:grid-cols-2">
                  <p>
                    <span className="text-[var(--dor-text)]">Уровень:</span> {a.gameLevel}
                  </p>
                  <p>
                    <span className="text-[var(--dor-text)]">Телефон:</span> {a.phone}
                  </p>
                  <p>
                    <span className="text-[var(--dor-text)]">Наркозависимость:</span>{" "}
                    {a.drugAddict ? "да" : "нет"}
                  </p>
                  <p>
                    <span className="text-[var(--dor-text)]">Инжен. образование:</span>{" "}
                    {a.engineeringEdu ? "да" : "нет"}
                  </p>
                  {a.educationLevel && (
                    <p className="md:col-span-2">
                      <span className="text-[var(--dor-text)]">Уровень образ.:</span>{" "}
                      {a.educationLevel}
                    </p>
                  )}
                  <p>
                    <span className="text-[var(--dor-text)]">Права:</span>{" "}
                    {a.driverLicense
                      ? a.licenseCategory ?? "—"
                      : "нет"}
                  </p>
                  <p>
                    <span className="text-[var(--dor-text)]">Ожид. доход:</span> ${" "}
                    {a.expectedIncome.toLocaleString("ru-RU")}
                  </p>
                  <p className="md:col-span-2">
                    <span className="text-[var(--dor-text)]">Собеседование:</span>{" "}
                    {new Date(a.interviewAt).toLocaleString("ru-RU")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
