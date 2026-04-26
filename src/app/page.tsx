import Link from "next/link";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { PublicGallery } from "@/components/PublicGallery";
import { JobSeekerForm } from "@/components/JobSeekerForm";

const DEPARTMENTS = [
  {
    title:
      "Служба инженерно-геологических, экологических и геодезических изысканий",
    text: "Изучение грунта, рисков для строительства и влияния проектов на природу.",
  },
  {
    title: "Отдел проектирования и технической документации",
    text: "Планы, чертежи, спецификации материалов и этапов — чтобы строить без сюрпризов.",
  },
  {
    title: "Департамент строительства и обслуживания",
    text: "Новые объекты, ремонт и поддержание зданий в рабочем состоянии.",
  },
  {
    title: "Служба технологического сопровождения и надзора",
    text: "Контроль оборудования, процессов и стандартов безопасности на объектах.",
  },
  {
    title: "Административный отдел",
    text: "Документы, планирование, координация и ресурсы для всех подразделений.",
  },
  {
    title: "Логистический отдел",
    text: "Маршруты, склады и своевременная доставка материалов на стройки.",
  },
  {
    title: "Лаборатория испытаний, аналитики и поверок",
    text: "Проверка материалов и конструкций на соответствие нормам качества.",
  },
];

export default async function HomePage() {
  const session = await getIronSession(await cookies(), sessionOptions);

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed={!!session.userId} isAdmin={!!session.isAdmin} />
      <main>
        <section id="about" className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="dor-card overflow-hidden p-8 md:p-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--dor-orange)]">
              СЕРВИСНЫЙ ПОРТАЛ DOPW
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">
              Департамент общественных работ и транспорта
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-[var(--dor-muted)]">
              ДОР формирует политику развития дорожной и городской инфраструктуры,
              обеспечивает инженерную безопасность объектов, реагирует на аварии и
              ведёт проекты от изысканий до сдачи — для комфорта и благополучия
              граждан штата.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#structure" className="dor-btn-primary">
                Структура и задачи
              </Link>
              <Link href="/#careers" className="dor-btn-secondary">
                Соискателям
              </Link>
              <Link href="/login" className="dor-btn-secondary">
                Вход сотрудника
              </Link>
            </div>
          </div>
        </section>

        <section id="structure" className="mx-auto max-w-6xl px-4 pb-16">
          <h2 className="text-2xl font-bold">Семь отделений</h2>
          <p className="mt-2 max-w-3xl text-[var(--dor-muted)]">
            Каждое направление закрывает свой фронт работ — от геодезии до лабораторных
            испытаний.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {DEPARTMENTS.map((d) => (
              <article key={d.title} className="dor-card p-5">
                <h3 className="font-semibold leading-snug">{d.title}</h3>
                <p className="mt-2 text-sm text-[var(--dor-muted)]">{d.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="careers" className="mx-auto max-w-6xl px-4 pb-20">
          <h2 className="text-2xl font-bold">Соискателям</h2>
          <p className="mt-3 max-w-4xl text-[var(--dor-muted)]">
            Ищете работу с смыслом, стабильным доходом и сильной командой? DoPW
            ищет ответственных инженеров, техников и мастеров поля: дороги, стройка,
            логистика и сопровождение — всё, что видно и ощутимо в штате. Заполните
            короткую форму, приходите на собеседование — мы сами свяжемся, чтобы
            согласовать встречу и поговорить о вашем опыте.
          </p>
          <div className="mt-4 w-full rounded-xl border border-[var(--dor-orange)]/25 bg-gradient-to-br from-[var(--dor-surface)] to-[var(--dor-night)] p-1">
            <div className="dor-card w-full p-5 md:p-8">
              <h3 className="text-lg font-semibold">Заявка на собеседование</h3>
              <p className="mt-1 text-sm text-[var(--dor-muted)]">
                Все поля важны для кадрового досье (IC/OOC в рамках вашей игры).
              </p>
              <JobSeekerForm />
            </div>
          </div>
        </section>

        <section id="gallery" className="mx-auto max-w-6xl px-4 pb-24">
          <h2 className="text-2xl font-bold">Фото нашей работы</h2>
          <PublicGallery />
        </section>
      </main>
      <footer className="border-t border-[var(--dor-border)] py-8 text-center text-sm text-[var(--dor-muted)]">
        Портал ДОР · Proxima RP · Не является официальным ресурсом Rockstar Games
      </footer>
    </div>
  );
}
