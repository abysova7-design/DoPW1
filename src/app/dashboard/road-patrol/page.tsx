"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { compressImage } from "@/lib/compress-image";
import { DispatchMapClient } from "@/components/DispatchMapClient";
import type { PositionRank } from "@/lib/positions";
import {
  PATROL_CHECKPOINTS,
  PATROL_REPORT_KINDS,
  PATROL_REPORT_KIND_HINTS,
  PATROL_REPORT_STATUS_RU,
  type PatrolReportKind,
} from "@/lib/road-patrol";
import type { WorkerMarker, CheckpointMarker } from "@/components/DispatchMap";

type Me = {
  id: string;
  nickname: string;
  isAdmin: boolean;
  isDispatcher: boolean;
  positionRank: PositionRank;
  displayName: string | null;
  xp: number;
  level: number;
};

type SituationWorker = {
  user: { id: string; nickname: string; displayName: string | null };
  lastPing: { lat: number; lng: number; createdAt: string } | null;
  activeEvacuation: { id: string; status: string; plate: string } | null;
  activeTask: { kind: string; title: string } | null;
};

type RoadClosureRow = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string | null;
  createdAt: string;
  authorId: string;
  author: { nickname: string; displayName: string | null };
};

type CheckpointDutyBundle = {
  checkpointId: number;
  users: { id: string; nickname: string; displayName: string | null }[];
};

export default function RoadPatrolPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [workers, setWorkers] = useState<SituationWorker[]>([]);
  const [briefOpen, setBriefOpen] = useState(true);
  const [tempCp, setTempCp] = useState<{ lat: number; lng: number } | null>(null);
  const [pickMode, setPickMode] = useState<"temp" | "report" | "closure" | null>(null);
  const [reportPick, setReportPick] = useState<{ lat: number; lng: number } | null>(null);
  const [closures, setClosures] = useState<RoadClosureRow[]>([]);
  const [closureModal, setClosureModal] = useState<{ lat: number; lng: number } | null>(null);
  const [closureTitle, setClosureTitle] = useState("");
  const [closureDesc, setClosureDesc] = useState("");
  const [closureBusy, setClosureBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ id: string; nickname: string; displayName: string | null }[]>(
    [],
  );
  const [partnerPick, setPartnerPick] = useState("");
  const [group, setGroup] = useState<{
    asLeader: { partner: { id: string; nickname: string } | null } | null;
    asPartner: { leader: { id: string; nickname: string } } | null;
  } | null>(null);
  const [myReports, setMyReports] = useState<
    {
      id: string;
      kind: string;
      note: string;
      status: string;
      createdAt: string;
      lat: number | null;
      lng: number | null;
      citizenNickname?: string | null;
      photoUrls?: string;
    }[]
  >([]);
  const [reportModalKind, setReportModalKind] = useState<PatrolReportKind | null>(null);
  const [reportDescription, setReportDescription] = useState("");
  const [reportCitizen, setReportCitizen] = useState("");
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);
  const [reportBusy, setReportBusy] = useState(false);
  const reportFileRef = useRef<HTMLInputElement>(null);
  const [plateSearch, setPlateSearch] = useState("");
  const [searchHits, setSearchHits] = useState<
    { id: string; plate: string; model: string | null; owner?: string | null; notes?: string | null }[]
  >([]);
  const [plateSearchErr, setPlateSearchErr] = useState<string | null>(null);
  const [registryOpen, setRegistryOpen] = useState(false);
  const [regPlate, setRegPlate] = useState("");
  const [regModel, setRegModel] = useState("");
  const [regOwner, setRegOwner] = useState("");
  const [regNotes, setRegNotes] = useState("");
  const [regPhoto, setRegPhoto] = useState<string | null>(null);
  const [regBusy, setRegBusy] = useState(false);
  const regFileRef = useRef<HTMLInputElement>(null);
  const [checkpointDuties, setCheckpointDuties] = useState<CheckpointDutyBundle[]>([]);
  const [cpDutyBusy, setCpDutyBusy] = useState(false);

  const load = useCallback(async () => {
    const rme = await fetch("/api/auth/me", { cache: "no-store" });
    const dme = await rme.json().catch(() => ({}));
    if (!dme.user) {
      router.replace("/login");
      return;
    }
    setMe(dme.user);

    const rs = await fetch("/api/road-patrol/situation", { cache: "no-store" });
    if (!rs.ok) {
      setMsg("Нет активной задачи «Дорожный патруль». Вернитесь в кабинет и выберите задачу.");
      setWorkers([]);
      setClosures([]);
      setCheckpointDuties([]);
      return;
    }
    const sd = await rs.json().catch(() => ({}));
    setWorkers(sd.workers ?? []);
    setClosures(sd.closures ?? []);
    setCheckpointDuties(sd.checkpointDuties ?? []);
    setMsg(null);

    const rg = await fetch("/api/road-patrol/group", { cache: "no-store" });
    if (rg.ok) setGroup(await rg.json());

    const rc = await fetch("/api/road-patrol/candidates", { cache: "no-store" });
    if (rc.ok) {
      const cd = await rc.json();
      setCandidates(cd.candidates ?? []);
      if (cd.currentPartner?.id) setPartnerPick(cd.currentPartner.id);
    }

    const rr = await fetch("/api/road-patrol/reports", { cache: "no-store" });
    if (rr.ok) {
      const rd = await rr.json();
      setMyReports(rd.reports ?? []);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const q = plateSearch.trim().toUpperCase();
    if (q.length < 2) {
      setSearchHits([]);
      setPlateSearchErr(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/vehicles/search?q=${encodeURIComponent(q)}&take=40`, { cache: "no-store" });
      if (cancelled) return;
      if (!r.ok) {
        setPlateSearchErr("Не удалось выполнить поиск (войдите в аккаунт или попробуйте позже).");
        setSearchHits([]);
        return;
      }
      const d = await r.json().catch(() => ({}));
      setPlateSearchErr(null);
      setSearchHits(d.vehicles ?? []);
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [plateSearch]);

  function openReportModal(kind: PatrolReportKind) {
    setReportModalKind(kind);
    setReportDescription("");
    setReportCitizen("");
    setReportPhotos([]);
    if (reportFileRef.current) reportFileRef.current.value = "";
    setMsg(null);
  }

  async function onReportPhotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const next: string[] = [...reportPhotos];
    for (let i = 0; i < files.length && next.length < 5; i++) {
      const f = files[i];
      try {
        const dataUrl = await compressImage(f, 1200, 900, 0.82);
        if (dataUrl.length > 850_000) {
          setMsg("Одно из фото слишком большое — выберите другие или меньше файлов.");
          return;
        }
        next.push(dataUrl);
      } catch {
        setMsg("Не удалось обработать фото.");
        return;
      }
    }
    setReportPhotos(next);
    setMsg(null);
  }

  async function submitReportModal() {
    if (!reportModalKind) return;
    if (!reportPick) {
      setMsg("Сначала укажите точку на карте: «Точка для отчёта», затем клик по карте.");
      return;
    }
    const description = reportDescription.trim();
    if (!description) {
      setMsg("Заполните описание: что сделали (RP).");
      return;
    }
    setReportBusy(true);
    const payload: Record<string, unknown> = {
      kind: reportModalKind,
      lat: reportPick.lat,
      lng: reportPick.lng,
      description,
      citizenNickname: reportCitizen.trim() || undefined,
      photoUrls: reportPhotos,
    };
    if (reportModalKind === "BLOCKPOST_TEMP" && tempCp) {
      payload.tempCheckpoint = { lat: tempCp.lat, lng: tempCp.lng };
    }
    const r = await fetch("/api/road-patrol/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    setReportBusy(false);
    if (!r.ok) {
      setMsg(d.error ?? "Ошибка отчёта");
      return;
    }
    setMsg(`Отчёт отправлен диспетчеру. +${d.xpGained ?? 5} XP`);
    setReportModalKind(null);
    setReportDescription("");
    setReportCitizen("");
    setReportPhotos([]);
    if (reportFileRef.current) reportFileRef.current.value = "";
    setReportPick(null);
    setPickMode(null);
    load();
  }

  async function invitePartner() {
    if (!partnerPick) return;
    const r = await fetch("/api/road-patrol/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId: partnerPick }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Не удалось добавить напарника");
      return;
    }
    setMsg("Напарник добавлен.");
    load();
  }

  async function dissolvePair() {
    await fetch("/api/road-patrol/group", { method: "DELETE" });
    setMsg("Пара расформирована (напарник снят с задачи).");
    load();
  }

  async function takeCheckpointDuty(checkpointId: number) {
    setCpDutyBusy(true);
    const r = await fetch("/api/road-patrol/checkpoint-duty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkpointId }),
    });
    const d = await r.json().catch(() => ({}));
    setCpDutyBusy(false);
    if (!r.ok) {
      setMsg(d.error ?? "Не удалось заступить на пост");
      return;
    }
    setMsg("Вы заступили на блок-пост (метка на карте станет зелёной у диспетчера).");
    load();
  }

  async function leaveCheckpointDuty() {
    setCpDutyBusy(true);
    const r = await fetch("/api/road-patrol/checkpoint-duty", { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    setCpDutyBusy(false);
    if (!r.ok) {
      setMsg(d.error ?? "Не удалось сняться с поста");
      return;
    }
    setMsg("Вы снялись с блок-поста.");
    load();
  }

  async function submitClosure() {
    if (!closureModal) return;
    const title = closureTitle.trim();
    if (!title) {
      setMsg("Укажите название перекрытия");
      return;
    }
    setClosureBusy(true);
    const r = await fetch("/api/road-patrol/closures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: closureModal.lat,
        lng: closureModal.lng,
        title,
        description: closureDesc.trim() || undefined,
      }),
    });
    setClosureBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Ошибка");
      return;
    }
    setClosureModal(null);
    setClosureTitle("");
    setClosureDesc("");
    setMsg(`Перекрытие на карте. +${d.xpGained ?? 5} XP`);
    load();
  }

  async function closeClosureRow(id: string) {
    const r = await fetch(`/api/road-patrol/closures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Не удалось снять метку");
      return;
    }
    setMsg("Перекрытие снято с карты.");
    load();
  }

  async function onRegistryPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await compressImage(f, 1200, 900, 0.82);
      if (dataUrl.length > 850_000) {
        setMsg("Фото слишком большое после сжатия — выберите другое.");
        setRegPhoto(null);
        return;
      }
      setRegPhoto(dataUrl);
      setMsg(null);
    } catch {
      setMsg("Не удалось обработать фото.");
      setRegPhoto(null);
    }
  }

  async function submitRegistry() {
    setRegBusy(true);
    const r = await fetch("/api/road-patrol/registry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plate: regPlate,
        model: regModel,
        owner: regOwner,
        notes: regNotes,
        photoUrl: regPhoto,
      }),
    });
    setRegBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(d.error ?? "Ошибка");
      return;
    }
    setRegistryOpen(false);
    setRegPlate("");
    setRegModel("");
    setRegOwner("");
    setRegNotes("");
    setRegPhoto(null);
    if (regFileRef.current) regFileRef.current.value = "";
    setMsg(`ТС внесено в базу, отчёт диспетчеру создан. +${d.xpGained ?? 5} XP`);
    load();
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Загрузка…
      </div>
    );
  }

  const markers: WorkerMarker[] = workers
    .filter((w) => w.lastPing)
    .map((w) => {
      const stale =
        new Date().getTime() - new Date(w.lastPing!.createdAt).getTime() > 20 * 60 * 1000;
      return {
        userId: w.user.id,
        nickname: w.user.nickname,
        lat: w.lastPing!.lat,
        lng: w.lastPing!.lng,
        stale,
        evacuating: Boolean(w.activeEvacuation),
        roadPatrol: w.activeTask?.kind === "ROAD_PATROL",
      };
    });

  const closureMapMarkers = closures.map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    title: c.title,
    description: c.description,
  }));

  const patrolReportMapMarkers = myReports
    .filter(
      (r) =>
        r.status !== "APPROVED" &&
        r.lat != null &&
        r.lng != null &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng),
    )
    .map((r) => ({
      id: r.id,
      lat: r.lat as number,
      lng: r.lng as number,
      label: (PATROL_REPORT_KINDS as Record<string, string>)[r.kind] ?? r.kind,
    }));

  const occupantsAt = (checkpointId: number) =>
    checkpointDuties.find((d) => d.checkpointId === checkpointId)?.users ?? [];

  const myStationaryCheckpointId =
    checkpointDuties.find((d) => d.users.some((u) => u.id === me.id))?.checkpointId ?? null;

  const checkpoints: CheckpointMarker[] = [
    ...PATROL_CHECKPOINTS.map((c) => ({
      id: `cp-${c.id}`,
      lat: c.lat,
      lng: c.lng,
      label: c.label,
      variant: "fixed" as const,
      stationaryCheckpointId: c.id,
      occupants: occupantsAt(c.id),
    })),
    ...(tempCp
      ? [
          {
            id: "temp-cp",
            lat: tempCp.lat,
            lng: tempCp.lng,
            label: "Временный блок-пост",
            variant: "temp" as const,
            onClearTemp: () => setTempCp(null),
          },
        ]
      : []),
  ];

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me.isAdmin} positionRank={me.positionRank} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">🛣️ Дорожный патруль</h1>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              Помощь гражданам, блок-посты, база ТС и координация с эвакуацией.
            </p>
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            ← Кабинет
          </Link>
        </div>

        <section className="dor-card overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[var(--dor-surface)]/50"
            onClick={() => setBriefOpen((o) => !o)}
          >
            <span className="font-semibold">Инструктаж</span>
            <span className="text-[var(--dor-muted)]">{briefOpen ? "▼" : "▶"}</span>
          </button>
          {briefOpen ? (
            <div className="space-y-3 border-t border-[var(--dor-border)] px-5 py-4 text-sm text-[var(--dor-muted)]">
              <p>
                <strong className="text-[var(--dor-text)]">Дорожный патруль</strong> — задача помощи
                гражданам: по запросу эвакуируйте, чините, заправляйте транспорт, оформляйте блок-посты и
                вносите данные в базу портала.
              </p>
              <p>
                На карте отмечены <strong>стационарные блок-посты</strong> (оранжевые — свободны, зелёные — на посту
                кто-то заступил; наведите на маркер — подсказка с именами). Откройте маркер и нажмите{" "}
                <strong>«Заступить на пост»</strong>. Вы можете создать <strong>временный блок-пост</strong> в любой
                точке (режим ниже). Метки <strong>⛔ перекрытия</strong> видны диспетчеру и коллегам на карте.
              </p>
              <ul className="list-inside list-disc space-y-1">
                {PATROL_CHECKPOINTS.map((c) => (
                  <li key={c.id}>
                    {c.label}: {c.lat}, {c.lng}
                  </li>
                ))}
              </ul>
              <p>
                Синие метки — коллеги на эвакуации; розовые — дорожный патруль; бирюзовые 🛣️ — ваши отчёты с
                координатами; зелёная круглая точка — выбранная «точка для отчёта»; 🟩 ромбы КП — заступление на
                стационарный пост; ⛔ — перекрытия. Отчёты диспетчеру и новые перекрытия дают +5 XP за действие.
              </p>
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <div className="dor-card p-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    pickMode === "temp"
                      ? "bg-purple-600 text-white"
                      : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                  }`}
                  onClick={() => setPickMode(pickMode === "temp" ? null : "temp")}
                >
                  Поставить временный КП (клик по карте)
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    pickMode === "report"
                      ? "bg-[var(--dor-orange)] text-black"
                      : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                  }`}
                  onClick={() => setPickMode(pickMode === "report" ? null : "report")}
                >
                  Точка для отчёта
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    pickMode === "closure"
                      ? "bg-amber-600 text-white"
                      : "bg-[var(--dor-surface)] text-[var(--dor-muted)]"
                  }`}
                  onClick={() => setPickMode(pickMode === "closure" ? null : "closure")}
                >
                  Перекрытие на карте (клик)
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--dor-muted)]">
                {pickMode === "temp"
                  ? "Кликните по карте — появится фиолетовый маркер временного блок-поста."
                  : pickMode === "report"
                    ? "Кликните по карте — координаты прикрепятся к следующему отчёту."
                    : pickMode === "closure"
                      ? "Кликните по карте — откроется форма перекрытия для диспетчерской карты."
                      : "Режим клика выключен."}
              </p>
              <div className="mt-3">
                <DispatchMapClient
                  workers={markers}
                  checkpointMarkers={checkpoints}
                  closureMarkers={closureMapMarkers}
                  patrolReportMarkers={patrolReportMapMarkers}
                  checkpointActions={{
                    myCheckpointId: myStationaryCheckpointId,
                    busy: cpDutyBusy,
                    onTake: takeCheckpointDuty,
                    onLeave: leaveCheckpointDuty,
                  }}
                  pickedLat={reportPick?.lat ?? null}
                  pickedLng={reportPick?.lng ?? null}
                  onPick={(lat, lng) => {
                    if (pickMode === "temp") {
                      setTempCp({ lat, lng });
                      setPickMode(null);
                    } else if (pickMode === "report") {
                      setReportPick({ lat, lng });
                      setPickMode(null);
                    } else if (pickMode === "closure") {
                      setClosureModal({ lat, lng });
                      setPickMode(null);
                    }
                  }}
                />
              </div>
              <div className="mt-4 border-t border-[var(--dor-border)] pt-4">
                <h3 className="text-sm font-semibold text-[var(--dor-text)]">Активные маркеры</h3>
                <p className="mt-1 text-[11px] text-[var(--dor-muted)]">
                  То, что сейчас отображается на карте: временный КП, точка для следующего отчёта и перекрытия.
                </p>

                <div className="mt-3 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--dor-text)]">Временный блок-пост</h4>
                    {tempCp ? (
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 px-2 py-2 text-[11px]">
                        <span className="text-[var(--dor-muted)]">
                          {Math.round(tempCp.lat)}, {Math.round(tempCp.lng)} · фиолетовый ромб на карте
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-purple-400/50 bg-[var(--dor-night)] px-2 py-1 text-[10px] font-medium text-purple-200 hover:bg-purple-950/40"
                          onClick={() => setTempCp(null)}
                        >
                          Сбросить с карты
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-[var(--dor-muted)]">
                        Не поставлен — включите режим выше и кликните по карте.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[var(--dor-text)]">Точка для отчёта</h4>
                    {reportPick ? (
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--dor-orange)]/35 bg-[var(--dor-orange)]/5 px-2 py-2 text-[11px]">
                        <span className="text-[var(--dor-muted)]">
                          {Math.round(reportPick.lat)}, {Math.round(reportPick.lng)} · зелёная метка на карте
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-1 text-[10px] font-medium hover:border-[var(--dor-orange)]"
                          onClick={() => setReportPick(null)}
                        >
                          Сбросить точку
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-[var(--dor-muted)]">
                        Не задана — режим «Точка для отчёта», затем клик по карте.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-[var(--dor-text)]">Активные перекрытия</h4>
                    {closures.length === 0 ? (
                      <p className="mt-1 text-[11px] text-[var(--dor-muted)]">
                        Нет меток — дорога свободна по данным патруля.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto text-[11px]">
                        {closures.map((c) => {
                          const canRemove =
                            me.id === c.authorId || me.isDispatcher || me.isAdmin;
                          return (
                            <li
                              key={c.id}
                              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)]/80 px-2 py-2"
                            >
                              <div>
                                <div className="font-medium text-[var(--dor-text)]">⛔ {c.title}</div>
                                <div className="text-[var(--dor-muted)]">
                                  {c.author.displayName ?? c.author.nickname} · {Math.round(c.lat)},{" "}
                                  {Math.round(c.lng)}
                                </div>
                                {c.description ? (
                                  <p className="mt-0.5 text-[var(--dor-muted)]">{c.description}</p>
                                ) : null}
                              </div>
                              {canRemove ? (
                                <button
                                  type="button"
                                  className="shrink-0 text-[10px] text-red-400 underline"
                                  onClick={() => closeClosureRow(c.id)}
                                >
                                  Снять
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="dor-card p-4">
              <h3 className="text-sm font-semibold">Пара патруля</h3>
              {group?.asPartner ? (
                <p className="mt-2 text-xs text-[var(--dor-muted)]">
                  Вы напарник у <strong>{group.asPartner.leader.nickname}</strong>
                </p>
              ) : group?.asLeader?.partner ? (
                <p className="mt-2 text-xs text-[var(--dor-muted)]">
                  Напарник: <strong>{group.asLeader.partner.nickname}</strong>
                </p>
              ) : (
                <p className="mt-2 text-xs text-[var(--dor-muted)]">Напарника нет — можно добавить.</p>
              )}
              {!group?.asPartner && !group?.asLeader?.partner && (
                <div className="mt-2 space-y-2">
                  <select
                    className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-2 text-sm"
                    value={partnerPick}
                    onChange={(e) => setPartnerPick(e.target.value)}
                  >
                    <option value="">— Сотрудник на смене без задачи —</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName ?? c.nickname}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="dor-btn-primary w-full text-xs" onClick={invitePartner}>
                    Добавить напарника
                  </button>
                </div>
              )}
              {(group?.asLeader?.partner || group?.asPartner) && (
                <button type="button" className="mt-2 text-xs text-red-400 underline" onClick={dissolvePair}>
                  Расформировать пару
                </button>
              )}
            </div>

            <div className="dor-card p-4">
              <h3 className="text-sm font-semibold">База эвакуации / ТС</h3>
              <input
                className="mt-2 w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-2 text-sm"
                placeholder="Поиск по номеру (мин. 2 символа)"
                value={plateSearch}
                onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
              <p className="mt-1 text-[10px] text-[var(--dor-muted)]">
                Результаты обновляются автоматически при вводе.
              </p>
              {plateSearchErr ? <p className="mt-1 text-[10px] text-red-400">{plateSearchErr}</p> : null}
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs">
                {searchHits.map((v) => (
                  <li key={v.id} className="text-[var(--dor-muted)]">
                    <span className="font-mono text-[var(--dor-text)]">{v.plate}</span>
                    {v.model ? ` · ${v.model}` : ""}
                  </li>
                ))}
              </ul>
              <Link href="/dashboard/evacuation" className="mt-3 block dor-btn-primary py-2 text-center text-xs">
                Тикет эвакуации
              </Link>
              <Link
                href="/dashboard/registry"
                className="mt-2 block rounded-lg border border-[var(--dor-border)] py-2 text-center text-xs text-[var(--dor-muted)] hover:border-[var(--dor-orange)] hover:text-[var(--dor-text)]"
              >
                Реестр и эвакуации
              </Link>
              <button
                type="button"
                className="mt-2 w-full dor-btn-secondary py-2 text-xs"
                onClick={() => setRegistryOpen(true)}
              >
                Внести ТС в базу (патруль)
              </button>
            </div>

            <div className="dor-card p-4">
              <h3 className="text-sm font-semibold">Отчёт диспетчеру (+5 XP)</h3>
              <p className="mt-1 text-[10px] text-[var(--dor-muted)]">
                {reportPick
                  ? `Точка отчёта: ${Math.round(reportPick.lat)}, ${Math.round(reportPick.lng)} (без неё отправить нельзя).`
                  : "Сначала «Точка для отчёта» и клик по карте — затем выберите тип и заполните форму."}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {(
                  Object.keys(PATROL_REPORT_KINDS).filter((k) => k !== "REGISTRY_ENTRY") as PatrolReportKind[]
                ).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-2 py-2 text-left text-xs hover:border-[var(--dor-orange)]"
                    onClick={() => openReportModal(k)}
                  >
                    {PATROL_REPORT_KINDS[k]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="dor-card p-4">
          <h3 className="text-sm font-semibold">Мои последние отчёты</h3>
          <ul className="mt-2 space-y-1 text-xs text-[var(--dor-muted)]">
            {myReports.slice(0, 12).map((r) => (
              <li key={r.id}>
                {(PATROL_REPORT_KINDS as Record<string, string>)[r.kind] ?? r.kind} ·{" "}
                {PATROL_REPORT_STATUS_RU[r.status] ?? r.status} · {new Date(r.createdAt).toLocaleString("ru-RU")}
              </li>
            ))}
          </ul>
        </section>

        {msg ? <p className="text-center text-sm text-[var(--dor-orange)]">{msg}</p> : null}
      </main>

      {reportModalKind ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="dor-card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto p-5">
            <h3 className="font-semibold">{PATROL_REPORT_KINDS[reportModalKind]}</h3>
            <p className="text-xs text-[var(--dor-muted)]">
              {reportPick
                ? `Точка на карте: ${Math.round(reportPick.lat)}, ${Math.round(reportPick.lng)}.`
                : (
                    <span className="text-amber-400">
                      Нет точки на карте — нажмите «Точка для отчёта» и кликните по карте.
                    </span>
                  )}
            </p>
            <p className="text-[11px] text-[var(--dor-muted)]">{PATROL_REPORT_KIND_HINTS[reportModalKind]}</p>
            <label className="text-xs text-[var(--dor-muted)]">Что сделали (RP) — обязательно</label>
            <textarea
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              rows={5}
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Опишите действия от первого лица RP…"
            />
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Ник в RP кому оказана помощь (если применимо)</label>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                value={reportCitizen}
                onChange={(e) => setReportCitizen(e.target.value)}
                placeholder="Например: Иван_Иванов"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Фото (необязательно, до 5)</label>
              <input
                ref={reportFileRef}
                type="file"
                accept="image/*"
                multiple
                className="mt-1 block w-full text-xs text-[var(--dor-muted)]"
                onChange={onReportPhotosChange}
              />
              {reportPhotos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {reportPhotos.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="h-16 w-20 rounded border border-[var(--dor-border)] object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="dor-btn-primary flex-1 text-sm"
                disabled={
                  reportBusy ||
                  !reportPick ||
                  !reportDescription.trim()
                }
                onClick={submitReportModal}
              >
                Отправить диспетчеру
              </button>
              <button
                type="button"
                className="dor-btn-secondary text-sm"
                disabled={reportBusy}
                onClick={() => {
                  setReportModalKind(null);
                  setReportDescription("");
                  setReportCitizen("");
                  setReportPhotos([]);
                  if (reportFileRef.current) reportFileRef.current.value = "";
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closureModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="dor-card w-full max-w-md space-y-3 p-5">
            <h3 className="font-semibold">Перекрытие на карте</h3>
            <p className="text-xs text-[var(--dor-muted)]">
              Точка: {Math.round(closureModal.lat)}, {Math.round(closureModal.lng)}. Метка увидят диспетчер и патруль.
            </p>
            <input
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Кратко: что перекрыто (напр. съезд с шоссе)"
              value={closureTitle}
              onChange={(e) => setClosureTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Подробности (необязательно): срок, объезд…"
              rows={3}
              value={closureDesc}
              onChange={(e) => setClosureDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="dor-btn-primary flex-1 text-sm"
                disabled={closureBusy || !closureTitle.trim()}
                onClick={submitClosure}
              >
                Опубликовать
              </button>
              <button
                type="button"
                className="dor-btn-secondary text-sm"
                onClick={() => {
                  setClosureModal(null);
                  setClosureTitle("");
                  setClosureDesc("");
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {registryOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="dor-card w-full max-w-md space-y-3 p-5">
            <h3 className="font-semibold">Внесение ТС (патруль)</h3>
            <p className="text-xs text-[var(--dor-muted)]">
              Не эвакуация — запись в реестр. Нужны номер, владелец и фото ТС. После сохранения начисляется XP и
              создаётся отчёт «Внесение в базу» для диспетчера.
            </p>
            <input
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Госномер"
              value={regPlate}
              onChange={(e) => setRegPlate(e.target.value.toUpperCase())}
            />
            <input
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Владелец ТС (обязательно)"
              value={regOwner}
              onChange={(e) => setRegOwner(e.target.value)}
              required
            />
            <input
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Модель (необязательно)"
              value={regModel}
              onChange={(e) => setRegModel(e.target.value)}
            />
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Фото ТС (обязательно)</label>
              <input
                ref={regFileRef}
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-xs text-[var(--dor-muted)]"
                onChange={onRegistryPhoto}
              />
              {regPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={regPhoto}
                  alt="Предпросмотр"
                  className="mt-2 max-h-40 w-full rounded-lg border border-[var(--dor-border)] object-contain"
                />
              ) : null}
            </div>
            <textarea
              className="w-full rounded-lg border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
              placeholder="Примечания (осмотр, нарушения…)"
              rows={3}
              value={regNotes}
              onChange={(e) => setRegNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="dor-btn-primary flex-1 text-sm"
                disabled={regBusy || !regPlate.trim() || !regOwner.trim() || !regPhoto}
                onClick={submitRegistry}
              >
                Внести в базу
              </button>
              <button
                type="button"
                className="dor-btn-secondary text-sm"
                onClick={() => setRegistryOpen(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
