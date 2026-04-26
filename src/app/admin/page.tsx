"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { RANK_ORDER, RANK_LABELS } from "@/lib/positions";
import type { PositionRank } from "@/lib/positions";
import { safeJson } from "@/lib/safe-fetch";


const DEPARTMENTS = [
  "Служба инженерных геологических экологических и геодезических изысканий",
  "Отдел проектирования и технической документации",
  "Департамент строительства и обслуживания",
  "Служба технологического сопровождения и надзора",
  "Административный отдел",
  "Логистический отдел",
  "Лаборатория испытаний, аналитики и поверок в строительстве",
];

type UserRow = {
  id: string;
  nickname: string;
  isAdmin: boolean;
  isDispatcher: boolean;
  positionRank: PositionRank;
  department: string | null;
  displayName: string | null;
  xp: number;
  level: number;
  towTruckCert: boolean;
  driverCert: boolean;
  createdAt: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<{
    isAdmin: boolean;
    positionRank: PositionRank;
  } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [vehicles, setVehicles] = useState<
    { id: string; plate: string; model: string | null; notes: string | null }[]
  >([]);

  const [newNick, setNewNick] = useState("");
  const [newRank, setNewRank] = useState<PositionRank>("TECHNICIAN");
  const [newDept, setNewDept] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdNick, setCreatedNick] = useState<string | null>(null);

  const [bcTitle, setBcTitle] = useState("Общий вызов");
  const [bcBody, setBcBody] = useState("");

  const [vPlate, setVPlate] = useState("");
  const [vModel, setVModel] = useState("");
  const [vNotes, setVNotes] = useState("");

  const [notifyUser, setNotifyUser] = useState("");
  const [notifyTitle, setNotifyTitle] = useState("Вызов на базу");
  const [notifyBody, setNotifyBody] = useState("Срочно явитесь на базу ДОР.");

  // Поощрения / выговоры
  const [discUser, setDiscUser] = useState("");
  const [discType, setDiscType] = useState<"AWARD" | "REPRIMAND">("AWARD");
  const [discReason, setDiscReason] = useState("");
  const [discMsg, setDiscMsg] = useState<string | null>(null);

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editRank, setEditRank] = useState<PositionRank>("TECHNICIAN");
  const [editDept, setEditDept] = useState("");
  const [editDisplay, setEditDisplay] = useState("");
  const [editDispatcher, setEditDispatcher] = useState(false);
  const [editAdmin, setEditAdmin] = useState(false);

  // Закрепление машин
  const [vaUserId, setVaUserId] = useState("");
  const [vaCid, setVaCid] = useState("");
  const [vaName, setVaName] = useState("");
  const [vaPhoto, setVaPhoto] = useState<string | null>(null);
  const [vaMsg, setVaMsg] = useState<string | null>(null);
  const [vaBusy, setVaBusy] = useState(false);
  const vaFileRef = useRef<HTMLInputElement>(null);
  const [vaList, setVaList] = useState<
    { id: string; cid: string; vehicleName: string; photoUrl: string | null; assignedAt: string; userId: string }[]
  >([]);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    if (!d.user?.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    setMe(d.user);
    const [u, v, va] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/vehicles").then((r) => r.json()),
      fetch("/api/vehicles/assigned?userId=ALL").then((r) =>
        r.ok ? r.json() : { vehicles: [] },
      ),
    ]);
    setUsers(u.users ?? []);
    setVehicles(v.vehicles ?? []);
    setVaList(va.vehicles ?? []);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreatedCode(null);
    setCreatedNick(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: newNick,
        positionRank: newRank,
        department: newDept,
        displayName: newDisplay,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error ?? "Ошибка");
      return;
    }
    setCreatedCode(d.oneTimeCode);
    setCreatedNick(String(d.user?.nickname ?? newNick));
    setNewNick("");
    setNewDept("");
    setNewDisplay("");
    refresh();
  }

  async function broadcast(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: bcTitle, message: bcBody }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error ?? "Ошибка");
      return;
    }
    alert(`Отправлено пользователям: ${d.sent}`);
    setBcBody("");
  }

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate: vPlate, model: vModel, notes: vNotes }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error ?? "Ошибка");
      return;
    }
    setVPlate("");
    setVModel("");
    setVNotes("");
    refresh();
  }

  function openEdit(u: UserRow) {
    setEditUserId(u.id);
    setEditRank(u.positionRank);
    setEditDept(u.department ?? "");
    setEditDisplay(u.displayName ?? "");
    setEditDispatcher(u.isDispatcher);
    setEditAdmin(u.isAdmin);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserId) return;
    const r = await fetch(`/api/admin/users/${editUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionRank: editRank,
        department: editDept,
        displayName: editDisplay,
        isDispatcher: editDispatcher,
        isAdmin: editAdmin,
      }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error ?? "Ошибка"); return; }
    setEditUserId(null);
    refresh();
  }

  async function onVaPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const { compressImage } = await import("@/lib/compress-image");
      const compressed = await compressImage(f, 800, 600, 0.75);
      setVaPhoto(compressed);
    } catch {
      setVaPhoto(null);
      setVaMsg("Не удалось обработать фото.");
    }
  }

  async function assignVehicle(e: React.FormEvent) {
    e.preventDefault();
    setVaBusy(true); setVaMsg(null);

    const photoPayload = vaPhoto && vaPhoto.length < 700_000 ? vaPhoto : null;

    try {
      const res = await fetch("/api/vehicles/assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: vaUserId,
          cid: vaCid,
          vehicleName: vaName,
          photoUrl: photoPayload,
        }),
      });
      const text = await res.text();
      let d: Record<string, string> = {};
      try { d = JSON.parse(text); } catch { /* HTML-ошибка — игнорируем */ }
      if (!res.ok) {
        setVaMsg(d.error ?? `Ошибка ${res.status}`);
      } else {
        setVaCid(""); setVaName(""); setVaPhoto(null);
        if (vaFileRef.current) vaFileRef.current.value = "";
        setVaMsg("✅ Машина закреплена.");
        refresh();
      }
    } catch {
      setVaMsg("Сетевая ошибка. Попробуйте снова.");
    } finally {
      setVaBusy(false);
    }
  }

  async function issueDiscipline(e: React.FormEvent) {
    e.preventDefault();
    setDiscMsg(null);
    const r = await fetch("/api/discipline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: discUser, type: discType, reason: discReason }),
    });
    const d = await safeJson<{ error?: string }>(r, {});
    if (!r.ok) { setDiscMsg(d.error ?? `Ошибка (код ${r.status})`); return; }
    setDiscReason("");
    setDiscMsg(discType === "AWARD" ? "🏆 Поощрение оформлено и отправлено в Приказы." : "⚠️ Выговор оформлен и отправлен в Приказы.");
  }

  async function removeVehicleAssignment(id: string) {
    await fetch(`/api/vehicles/assigned?id=${id}`, { method: "DELETE" });
    refresh();
  }

  async function sendNotify(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: notifyUser,
        title: notifyTitle,
        message: notifyBody,
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error ?? "Ошибка");
      return;
    }
    alert("Уведомление отправлено.");
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
        Проверка доступа…
      </div>
    );
  }

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader
        authed
        isAdmin
        positionRank={me.positionRank}
      />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Администрирование</h1>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">
            Личный кабинет
          </Link>
        </div>

        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">Создать сотрудника</h2>
          <p className="mt-1 text-sm text-[var(--dor-muted)]">
            Одноразовый код показывается только сейчас — передайте его игроку для
            входа.
          </p>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={createUser}>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Никнейм</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={newNick}
                onChange={(e) => setNewNick(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Должность</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={newRank}
                onChange={(e) => setNewRank(e.target.value as PositionRank)}
              >
                {RANK_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {RANK_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Отдел / подразделение</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
              >
                <option value="">— не указан —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Отображаемое имя</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                placeholder="Необязательно"
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="dor-btn-primary">
                Выдать доступ
              </button>
            </div>
          </form>
          {createdCode ? (
            <div className="mt-4 rounded-xl border border-[var(--dor-orange)]/50 bg-[var(--dor-orange)]/10 p-3 text-sm">
              Код для <strong>{createdNick ?? "сотрудника"}</strong>:{" "}
              <code className="text-lg font-bold tracking-widest">{createdCode}</code>
            </div>
          ) : null}
        </section>

        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">Общий вызов</h2>
          <form className="mt-4 space-y-3" onSubmit={broadcast}>
            <input
              className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
              value={bcTitle}
              onChange={(e) => setBcTitle(e.target.value)}
              placeholder="Заголовок"
            />
            <textarea
              className="w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
              rows={3}
              value={bcBody}
              onChange={(e) => setBcBody(e.target.value)}
              placeholder="Текст для всех сотрудников"
              required
            />
            <button type="submit" className="dor-btn-primary">
              Разослать
            </button>
          </form>
        </section>

        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">Вызов на базу (один сотрудник)</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={sendNotify}>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Пользователь</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={notifyUser}
                onChange={(e) => setNotifyUser(e.target.value)}
                required
              >
                <option value="">— выберите —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname} (id {u.id.slice(0, 8)}…)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Заголовок</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Сообщение</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="dor-btn-primary">
                Отправить уведомление
              </button>
            </div>
          </form>
        </section>

        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">База ТС для эвакуации</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={addVehicle}>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Номер</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 font-mono"
                value={vPlate}
                onChange={(e) => setVPlate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Модель</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={vModel}
                onChange={(e) => setVModel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Заметка</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                value={vNotes}
                onChange={(e) => setVNotes(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className="dor-btn-secondary">
                Добавить ТС
              </button>
            </div>
          </form>
          <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto text-sm text-[var(--dor-muted)]">
            {vehicles.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 font-mono">
                <span>
                  {v.plate} {v.model ? `· ${v.model}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Поощрения / выговоры ── */}
        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">📜 Поощрения и выговоры</h2>
          <p className="mt-1 text-sm text-[var(--dor-muted)]">
            Автоматически публикуются в канале «Приказы» и уведомляют сотрудника.
          </p>
          <form className="mt-4 space-y-3" onSubmit={issueDiscipline}>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Сотрудник</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                value={discUser}
                onChange={(e) => setDiscUser(e.target.value)}
                required
              >
                <option value="">— выберите сотрудника —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname}{u.displayName ? ` (${u.displayName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {(["AWARD", "REPRIMAND"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDiscType(t)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    discType === t
                      ? t === "AWARD"
                        ? "bg-yellow-500/20 border border-yellow-500/50 text-yellow-400"
                        : "bg-red-500/20 border border-red-500/50 text-red-400"
                      : "border border-[var(--dor-border)] text-[var(--dor-muted)]"
                  }`}
                >
                  {t === "AWARD" ? "🏆 Поощрение" : "⚠️ Выговор"}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Основание / формулировка</label>
              <textarea
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm outline-none focus:border-[var(--dor-orange)]"
                rows={3}
                placeholder="Напр: За проявленную инициативу при ликвидации аварии на El Corona…"
                value={discReason}
                onChange={(e) => setDiscReason(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="dor-btn-primary text-sm">
              Оформить приказ
            </button>
            {discMsg && (
              <p className="text-sm text-[var(--dor-muted)]">{discMsg}</p>
            )}
          </form>
        </section>

        {/* ── Закрепление машин ── */}
        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">🚗 Закрепить машину за сотрудником</h2>
          <p className="mt-1 text-sm text-[var(--dor-muted)]">
            Максимум 3 машины на сотрудника. Машина отображается в личном кабинете.
          </p>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={assignVehicle}>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">Сотрудник</label>
              <select
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                value={vaUserId}
                onChange={(e) => setVaUserId(e.target.value)}
                required
              >
                <option value="">— выберите сотрудника —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nickname}{u.displayName ? ` (${u.displayName})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">cID машины (/vehstat)</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 font-mono text-sm"
                placeholder="напр. 1417"
                value={vaCid}
                onChange={(e) => setVaCid(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-[var(--dor-muted)]">Название машины</label>
              <input
                className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2 text-sm"
                placeholder="напр. Towruck"
                value={vaName}
                onChange={(e) => setVaName(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--dor-muted)]">📷 Фото авто (необязательно)</label>
              <input
                ref={vaFileRef}
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm text-[var(--dor-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--dor-surface)] file:px-3 file:py-1 file:text-xs file:text-[var(--dor-text)]"
                onChange={onVaPhoto}
              />
              {vaPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vaPhoto} alt="preview" className="mt-2 h-20 rounded-lg object-cover" />
              )}
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <button type="submit" disabled={vaBusy} className="dor-btn-primary text-sm disabled:opacity-50">
                Закрепить машину
              </button>
              {vaUserId && (
                <span className="text-xs text-[var(--dor-muted)]">
                  Уже закреплено: {vaList.filter((v) => v.userId === vaUserId).length} / 3
                </span>
              )}
            </div>
            {vaMsg && <p className="md:col-span-2 text-sm text-[var(--dor-muted)]">{vaMsg}</p>}
          </form>

          {/* Список всех закреплённых машин */}
          {vaList.length > 0 && (
            <div className="mt-5 border-t border-[var(--dor-border)] pt-4">
              <h3 className="mb-3 text-sm font-medium text-[var(--dor-muted)]">Все закреплённые машины</h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {vaList.map((v) => {
                  const owner = users.find((u) => u.id === v.userId);
                  return (
                    <div key={v.id} className="overflow-hidden rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)]">
                      {v.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.photoUrl} alt={v.vehicleName} className="h-20 w-full object-cover" />
                      )}
                      <div className="p-2">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <div className="text-sm font-medium">{v.vehicleName}</div>
                            <div className="font-mono text-xs text-[var(--dor-orange)]">cID: {v.cid}</div>
                            <div className="text-xs text-[var(--dor-muted)]">
                              {owner?.nickname ?? "—"}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20"
                            onClick={() => removeVehicleAssignment(v.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* ── Редактор сотрудника ── */}
        {editUserId ? (
          <section className="dor-card border border-[var(--dor-orange)]/50 p-6">
            <h2 className="text-lg font-semibold">
              Редактировать:{" "}
              {users.find((u) => u.id === editUserId)?.nickname}
            </h2>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveEdit}>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">Должность</label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                  value={editRank}
                  onChange={(e) => setEditRank(e.target.value as PositionRank)}
                >
                  {RANK_ORDER.map((r) => (
                    <option key={r} value={r}>{RANK_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">Отдел</label>
                <select
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                >
                  <option value="">— не указан —</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--dor-muted)]">Отображаемое имя</label>
                <input
                  className="mt-1 w-full rounded-xl border border-[var(--dor-border)] bg-[var(--dor-night)] px-3 py-2"
                  value={editDisplay}
                  onChange={(e) => setEditDisplay(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 pt-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--dor-orange)]"
                    checked={editDispatcher}
                    onChange={(e) => setEditDispatcher(e.target.checked)}
                  />
                  Роль диспетчера 📡
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[var(--dor-orange)]"
                    checked={editAdmin}
                    onChange={(e) => setEditAdmin(e.target.checked)}
                  />
                  Доступ к Админке 👑
                </label>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <button type="submit" className="dor-btn-primary">
                  Сохранить + издать приказ
                </button>
                <button
                  type="button"
                  className="dor-btn-secondary"
                  onClick={() => setEditUserId(null)}
                >
                  Отмена
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="dor-card p-6">
          <h2 className="text-lg font-semibold">Сотрудники</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[var(--dor-muted)]">
                <tr>
                  <th className="pb-2 pr-3">Ник</th>
                  <th className="pb-2 pr-3">Ранг</th>
                  <th className="pb-2 pr-3">Отдел</th>
                  <th className="pb-2 pr-2 text-center">LVL</th>
                  <th className="pb-2 pr-2 text-center">🚛</th>
                  <th className="pb-2 pr-2 text-center">🚗</th>
                  <th className="pb-2 pr-2 text-center">📡</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--dor-border)]">
                    <td className="py-2 pr-3 font-medium">
                      {u.nickname}
                      {u.isAdmin ? (
                        <span className="ml-1 text-xs text-blue-400">👑</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-xs text-[var(--dor-muted)]">
                      {RANK_LABELS[u.positionRank]}
                    </td>
                    <td className="py-2 pr-3 text-xs text-[var(--dor-muted)]">
                      {u.department ?? "—"}
                    </td>
                    <td className="py-2 pr-2 text-center">{u.level}</td>
                    <td className="py-2 pr-2 text-center text-xs">
                      {u.towTruckCert ? "✅" : "—"}
                    </td>
                    <td className="py-2 pr-2 text-center text-xs">
                      {u.driverCert ? "✅" : "—"}
                    </td>
                    <td className="py-2 pr-2 text-center text-xs">
                      {u.isDispatcher ? "✅" : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="dor-btn-secondary px-2 py-1 text-xs"
                        onClick={() => openEdit(u)}
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
