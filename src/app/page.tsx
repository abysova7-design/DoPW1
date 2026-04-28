import Link from "next/link";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { PublicGallery } from "@/components/PublicGallery";
import { JobSeekerForm } from "@/components/JobSeekerForm";
import { PublicEvacuationLookup } from "@/components/PublicEvacuationLookup";

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
        <section id="about" className="mx-auto max-w-6xl px-3 py-10 sm:px-4 sm:py-16 md:py-24">
          <div className="dor-card overflow-hidden p-5 sm:p-8 md:p-12">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--dor-orange)] sm:text-sm sm:tracking-[0.2em]">
              СЕРВИСНЫЙ ПОРТАЛ DOPW
            </p>
            <h1 className="mt-3 text-2xl font-bold leading-tight sm:mt-4 sm:text-3xl md:text-5xl">
              Департамент общественных работ и транспорта
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--dor-muted)] sm:mt-6 sm:text-lg">
              ДОР формирует политику развития дорожной и городской инфраструктуры,
              обеспечивает инженерную безопасность объектов, реагирует на аварии и
              ведёт проекты от изысканий до сдачи — для комфорта и благополучия
              граждан штата.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
              <Link href="/help" className="dor-btn-primary w-full justify-center sm:w-auto">
                Помощь
              </Link>
              <Link href="/complaint" className="dor-btn-secondary w-full justify-center sm:w-auto">
                Жалоба на сотрудника
              </Link>
              <Link href="/#evacuation-check" className="dor-btn-secondary w-full justify-center sm:w-auto">
                Проверка по номеру эвакуации
              </Link>
              <Link href="/#careers" className="dor-btn-secondary w-full justify-center sm:w-auto">
                Соискателям
              </Link>
              <Link href="/login" className="dor-btn-secondary w-full justify-center sm:w-auto">
                Вход сотрудника
              </Link>
            </div>
          </div>
        </section>

        <section id="evacuation-check" className="mx-auto max-w-6xl px-3 pb-16 sm:px-4 sm:pb-20">
          <h2 className="text-xl font-bold sm:text-2xl">Эвакуировали транспорт?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--dor-muted)] sm:text-base">
            Проверьте по госномеру, что зафиксировано в завершённых эвакуациях департамента: нарушение, дата и
            время, фотоматериалы. Персональные данные владельца и сведения о сотруднике в открытый ответ не
            включаются.
          </p>
          <div className="dor-card mt-6 w-full p-5 md:p-8">
            <PublicEvacuationLookup />
          </div>
        </section>

        <section id="structure" className="mx-auto max-w-6xl px-3 pb-12 sm:px-4 sm:pb-16">
          <h2 className="text-xl font-bold sm:text-2xl">Семь отделений</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--dor-muted)] sm:text-base">
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

        <section id="careers" className="mx-auto max-w-6xl px-3 pb-16 sm:px-4 sm:pb-20">
          <h2 className="text-xl font-bold sm:text-2xl">Соискателям</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-[var(--dor-muted)] sm:text-base">
            Ищете работу с смыслом, стабильным доходом и сильной командой? DoPW
            ищет ответственных инженеров, техников и мастеров поля: дороги, стройка,
            логистика и сопровождение — всё, что видно и ощутимо в штате. Заполните
            короткую форму, приходите на собеседование — мы сами свяжемся, чтобы
            согласовать встречу и поговорить о вашем опыте.
          </p>
          <div className="dor-card mt-4 w-full p-5 md:p-8">
            <h3 className="text-lg font-semibold">Заявка на собеседование</h3>
            <p className="mt-1 text-sm text-[var(--dor-muted)]">
              Все поля важны для кадрового досье (IC/OOC в рамках вашей игры).
            </p>
            <JobSeekerForm />
          </div>
        </section>

        <section id="gallery" className="mx-auto max-w-6xl px-3 pb-16 sm:px-4 sm:pb-24">
          <h2 className="text-xl font-bold sm:text-2xl">Фото нашей работы</h2>
          <PublicGallery />
        </section>
      </main>
      <footer className="border-t border-[var(--dor-border)] px-3 py-6 text-center text-xs text-[var(--dor-muted)] sm:py-8 sm:text-sm">
        Портал ДОР · Proxima RP · Не является официальным ресурсом Rockstar Games
      </footer>
    </div>
  );
}
