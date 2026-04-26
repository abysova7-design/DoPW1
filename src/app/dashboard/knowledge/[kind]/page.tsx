"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import type { PositionRank } from "@/lib/positions";

/* ─── тексты правил ────────────────────────────────────── */

const EVAC_RULES = `
## Правила использования эвакуатора

**Перед началом:**  
Активировать оранжевые маячки и установить ограждение.

**Если авто стоит в неположенном месте:**
1. Вызвать сотрудника полиции ближайшего участка, чтобы установить владельца.
   > /d DoPW to HP: Выйдите на связь, нужны ближайшие юниты по [квадрат/улица], для пробивания номера владельца транспорта.
2. Дать владельцу **5 минут** на самостоятельную перепарковку без санкций.
3. При звонке — **обязательно представиться**:  
   «Здравствуйте, вас беспокоит [Имя] из директора Департамента общественных работ и транспорта. Ваш [марка авто] припаркован у [место] в неположенном месте. Не могли бы его перепарковать? У вас есть 5 минут, иначе мы вынуждены увезти его на штрафстоянку.»

**Эвакуируем только если:**
- Владелец не предпринял действий за 5 минут (если опоздал чуть-чуть — войти в положение);
- До владельца не дозвонились 5 минут;
- Владельца нет в сети.

**Категорически запрещено эвакуировать, если:**
- Владелец лично присутствует рядом или сидит в авто;
- Офицер полиции запретил эвакуацию;
- Идёт активная ситуация (погоня, обыск) — ждать разрешения офицера.

---

## Обязательные скриншоты

| Что снимаем | Зачем |
|---|---|
| Номер авто через **/vehstat** | Подтверждение нарушителя |
| Пробивка по базе (окно с маркой и владельцем) | Связь с полицией |
| Статус владельца в TAB (в сети / нет) | Основание для эвакуации |
| Прошло 5 минут без реакции | Доказательство попытки урегулировать |

> Скриншоты защищают вас от жалоб. **Без документации — нет основания для эвакуации.**

---

## Если авто после погони

Спросить у офицеров на месте, нормально ли играл человек и стоит ли везти на штрафстоянку. Иметь скриншот запроса в рацию и скриншот авто с номерами.

---

## Важно

- ДОР **не полиция** и не штрафует граждан.  
- Принимать деньги от граждан **строго запрещено** (Единый регламент, гл. 2, п. 2.3).  
- Каждый сотрудник-эвакуаторщик обязан знать **Часть III Дорожного кодекса** (нарушения парковки и стоянки).
- За буксировку без причин — увольнение, ЧС, варн или бан.
`;

const DRIVER_RULES = `
## Правила для водителей ДОР

### 📌 Трудоустройство и ранги

- Все водители принимаются на первый ранг — **Trainee Technician** (15 000 $/смена — на время обучения).
- До прохождения аттестации ❗ **запрещено управление транспортом**.
- После успешной аттестации — повышение до **Engineer I** (18 000 $ + премиальные).

---

### 🚗 Обучение и транспорт

- Каждый водитель обучается не более чем на **2 вида транспорта** из автопарка.
- На каждый вид ТС закрепляется не более **2 водителей**.

---

### 📋 Порядок заступления на смену

1. Взять смену (через портал — кнопка «Начать смену»).
2. Получить на складе форму: жилет + каска.
3. Проверить закреплённый транспорт: повреждения и уровень топлива.
4. Объявить в рацию /rr:
   > /rr [cID из /vehstat] Машина проверена, готова к работе.
5. ТС разрешено использовать **только** для ремонта, заправки и рабочих задач.
   - Затраты на топливо и ремонт возмещаются.

---

### 📝 Аттестация

Проводит: **Начальник автоколонны / Заместитель директора / Директор ДОР.**

Испытания:
- Вождение выбранного ТС.
- Парковка.
- Движение в колонне.
- Дополнительные испытания по усмотрению начальника.

---

### ⚙️ Цепочка подчинения

Водитель → Начальник автоколонны → Заместитель директора → Директор DoPW

Сотрудник DoPW (3 ранг) взаимодействует с водителями в рамках рабочих выездов.

---

Соблюдайте регламент, будьте внимательны на дорогах! 🚧🚛
`;

/* ─── вопросы (клиентская сторона без правильных ответов) ─ */

const TOW_Q = [
  { id: "tt1", text: "Сколько минут даётся владельцу автомобиля на перепарковку после предупреждения?", opts: ["2 минуты", "3 минуты", "5 минут", "10 минут"] },
  { id: "tt2", text: "Что нужно сделать первым, если авто стоит в неположенном месте?", opts: ["Немедленно начать эвакуацию", "Вызвать сотрудника полиции, чтобы установить владельца", "Позвонить диспетчеру ДОР за разрешением", "Установить ограждение и ждать 10 минут"] },
  { id: "tt3", text: "Какие скриншоты ОБЯЗАТЕЛЬНО нужны при эвакуации?", opts: ["Только фото самого нарушения", "Только номер авто через /vehstat", "Номер авто, пробивка по базе, статус в сети, отсутствие реакции 5 мин", "Скриншот чата с диспетчером и рацией"] },
  { id: "tt4", text: "Разрешено ли сотруднику ДОР принимать деньги от гражданина?", opts: ["Да, если сумма до 5 000$", "Да, только наличными", "Нет — запрещено пунктом 2.3 единого регламента правительства", "Разрешено при разрешении директора"] },
  { id: "tt5", text: "В каком случае эвакуация запрещена вне зависимости от нарушения?", opts: ["Если машина блокирует проезд", "Если владелец лично присутствует рядом с авто", "Если владелец не отвечает 3 минуты", "Если нет ограждения на точке"] },
];

const DRIVER_Q = [
  { id: "dr1", text: "На сколько видов транспорта из автопарка может быть обучен один водитель?", opts: ["1", "2", "3", "Без ограничений"] },
  { id: "dr2", text: "На каком ранге начинают все водители при трудоустройстве?", opts: ["Engineer I", "Technician", "Trainee Technician", "Engineer II"] },
  { id: "dr3", text: "Что обязательно нужно объявить в рацию /rr при заступлении на смену?", opts: ["Своё имя и ранг", "Маршрут выезда", "[cID из /vehstat] — 'Машина проверена, готова к работе'", "Запрос разрешения у директора"] },
  { id: "dr4", text: "Кто имеет право проводить аттестацию водителей?", opts: ["Любой Engineer II", "Начальник автоколонны / заместитель директора / директор ДОР", "Только директор ДОР", "Диспетчер смены"] },
  { id: "dr5", text: "До прохождения аттестации водителю...", opts: ["Разрешено управление лёгким транспортом с наставником", "Разрешено всё, кроме спецтехники", "Запрещено управление любым транспортом из автопарка", "Разрешено ездить только на территории базы"] },
];

const KINDS: Record<string, { label: string; rules: string; questions: { id: string; text: string; opts: string[] }[]; certKey: string }> = {
  evacuation: {
    label: "Эвакуатор",
    rules: EVAC_RULES,
    questions: TOW_Q,
    certKey: "TOW_TRUCK",
  },
  driver: {
    label: "Водитель",
    rules: DRIVER_RULES,
    questions: DRIVER_Q,
    certKey: "DRIVER",
  },
};

/* ─── простой Markdown-рендер ─────────────────────────────── */
function RuleBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm leading-relaxed text-[var(--dor-muted)]">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="mt-4 text-base font-bold text-[var(--dor-text)]">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="mt-3 font-semibold text-[var(--dor-text)]">{line.slice(4)}</h3>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc">{mdInline(line.slice(2))}</li>;
        if (line.startsWith("> ")) return <blockquote key={i} className="rounded-lg border-l-4 border-[var(--dor-orange)] bg-[var(--dor-surface)] px-3 py-1 font-mono text-xs text-[var(--dor-text)]">{line.slice(2)}</blockquote>;
        if (line.startsWith("---")) return <hr key={i} className="border-[var(--dor-border)]" />;
        if (line.trim() === "") return <div key={i} className="h-2" />;
        if (line.startsWith("|")) return null;
        return <p key={i}>{mdInline(line)}</p>;
      })}
    </div>
  );
}
function mdInline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="text-[var(--dor-text)]">{p.slice(2, -2)}</strong> : p,
  );
}

/* ─── страница ─────────────────────────────────────────────── */

export default function KnowledgePage() {
  const params = useParams();
  const router = useRouter();
  const rawKind = Array.isArray(params?.kind) ? params.kind[0] : (params?.kind ?? "");
  const kind = KINDS[rawKind];

  const [me, setMe] = useState<{ positionRank: PositionRank; isAdmin: boolean; towTruckCert: boolean; driverCert: boolean } | null>(null);
  const [tab, setTab] = useState<"rules" | "quiz">("rules");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean; details: { id: string; correct: boolean; rightAnswer: number }[] } | null>(null);
  const [registering, setRegistering] = useState(false);
  const [regMsg, setRegMsg] = useState<string | null>(null);
  const [examReg, setExamReg] = useState<{ status: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (!d.user) { router.replace("/login"); return; } setMe(d.user); });
    if (kind) {
      fetch("/api/exams").then(r => r.json()).then(d => {
        const mine = (d.exams ?? []).find((e: { kind: string; status: string }) => e.kind === kind.certKey);
        setExamReg(mine ?? null);
      });
    }
  }, [router, kind]);

  if (!kind) return (
    <div className="flex min-h-screen items-center justify-center flex-col gap-4">
      <p className="text-[var(--dor-muted)]">Раздел не найден.</p>
      <Link href="/dashboard" className="dor-btn-secondary">← Кабинет</Link>
    </div>
  );

  async function submitQuiz() {
    if (Object.keys(answers).length < kind.questions.length) {
      alert("Ответьте на все вопросы."); return;
    }
    const r = await fetch("/api/knowledge/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: kind.certKey, answers }),
    });
    const d = await r.json();
    setResult(d);
  }

  async function registerForExam() {
    if (!result?.passed) return;
    setRegistering(true); setRegMsg(null);
    const r = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: kind.certKey, testScore: result.score }),
    });
    setRegistering(false);
    const d = await r.json();
    if (!r.ok) { setRegMsg(d.error ?? "Ошибка"); return; }
    setRegMsg("Вы записаны на экзамен. Экзаменатор назначит время.");
    setExamReg(d.exam);
  }

  const certified = kind.certKey === "TOW_TRUCK" ? me?.towTruckCert : me?.driverCert;

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed isAdmin={me?.isAdmin} positionRank={me?.positionRank} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">📖 Допуск: {kind.label}</h1>
            {certified && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[var(--dor-green)]/20 px-2 py-0.5 text-sm text-[var(--dor-green-bright)]">
                ✅ Допуск получен
              </span>
            )}
          </div>
          <Link href="/dashboard" className="dor-btn-secondary text-sm">← Кабинет</Link>
        </div>

        <div className="flex gap-2">
          {(["rules", "quiz"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`dor-btn text-sm ${tab === t ? "dor-btn-primary" : "dor-btn-secondary"}`}
            >
              {t === "rules" ? "📄 Правила" : "📝 Тест"}
            </button>
          ))}
        </div>

        {tab === "rules" && (
          <section className="dor-card p-6">
            <RuleBlock text={kind.rules} />
            <div className="mt-6">
              <button type="button" className="dor-btn-primary text-sm" onClick={() => setTab("quiz")}>
                Перейти к тесту →
              </button>
            </div>
          </section>
        )}

        {tab === "quiz" && (
          <section className="dor-card space-y-5 p-6">
            {!result ? (
              <>
                <p className="text-sm text-[var(--dor-muted)]">
                  5 вопросов. Для записи на экзамен нужно ответить правильно минимум на 4.
                </p>
                {kind.questions.map((q, qi) => (
                  <div key={q.id} className="rounded-xl border border-[var(--dor-border)] p-4">
                    <p className="font-medium">
                      {qi + 1}. {q.text}
                    </p>
                    <div className="mt-3 space-y-2">
                      {q.opts.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 text-sm transition ${
                            answers[q.id] === oi
                              ? "border-[var(--dor-orange)] bg-[var(--dor-orange)]/10"
                              : "border-[var(--dor-border)] hover:bg-[var(--dor-surface)]"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="accent-[var(--dor-orange)]"
                            checked={answers[q.id] === oi}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" className="dor-btn-primary" onClick={submitQuiz}>
                  Сдать тест
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-xl border p-4 ${result.passed ? "border-[var(--dor-green)]/50 bg-[var(--dor-green)]/10" : "border-red-500/40 bg-red-500/10"}`}>
                  <div className="text-2xl font-bold">
                    {result.passed ? "✅ Тест пройден!" : "❌ Тест не пройден"}
                  </div>
                  <p className="mt-1 text-[var(--dor-muted)]">
                    Правильных ответов: {result.score} / {result.total}
                  </p>
                  {!result.passed && (
                    <p className="mt-2 text-sm text-[var(--dor-muted)]">
                      Изучите правила ещё раз и попробуйте снова.
                    </p>
                  )}
                </div>

                {result.details.map((d, i) => (
                  <div
                    key={d.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${d.correct ? "border-[var(--dor-green)]/30" : "border-red-500/30"}`}
                  >
                    {d.correct ? "✅" : "❌"}
                    <span>Вопрос {i + 1}</span>
                    {!d.correct && (
                      <span className="ml-auto text-xs text-[var(--dor-muted)]">
                        Правильно: вариант {d.rightAnswer + 1}
                      </span>
                    )}
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="dor-btn-secondary text-sm"
                    onClick={() => { setResult(null); setAnswers({}); }}
                  >
                    Пройти ещё раз
                  </button>
                  {result.passed && !certified && !examReg && (
                    <button
                      type="button"
                      className="dor-btn-primary text-sm"
                      disabled={registering}
                      onClick={registerForExam}
                    >
                      Записаться на экзамен
                    </button>
                  )}
                  {examReg && (
                    <span className="rounded-xl border border-[var(--dor-green)]/40 bg-[var(--dor-green)]/10 px-3 py-2 text-sm">
                      📋 Вы записаны на экзамен (статус: {examReg.status})
                    </span>
                  )}
                </div>
                {regMsg && <p className="text-sm text-[var(--dor-muted)]">{regMsg}</p>}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
