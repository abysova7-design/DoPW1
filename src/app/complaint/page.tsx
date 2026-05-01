import Link from "next/link";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type DorSessionData } from "@/lib/session";
import { SiteHeader } from "@/components/SiteHeader";
import { StaffComplaintForm } from "@/components/StaffComplaintForm";

export default async function ComplaintPage() {
  const session = await getIronSession<DorSessionData>(await cookies(), sessionOptions);

  return (
    <div className="dor-stripes min-h-screen">
      <SiteHeader authed={!!session.userId} isAdmin={!!session.isAdmin} />
      <main className="mx-auto max-w-3xl px-3 py-10 sm:px-4 sm:py-14">
        <Link href="/" className="text-sm text-[var(--dor-orange)] hover:underline">
          ← На главную
        </Link>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Жалоба на сотрудника</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--dor-muted)] sm:text-base">
          Если вы столкнулись с грубостью, злоупотреблением полномочиями или нарушением регламента со стороны
          сотрудника DOPW, опишите ситуацию ниже. Обращение увидят администрация и диспетчерский центр; ложные
          доносы могут повлечь ответственность по внутренним правилам штата.
        </p>
        <div className="mt-8 w-full rounded-xl border border-red-500/20 bg-gradient-to-br from-[var(--dor-surface)] to-[var(--dor-night)] p-1">
          <div className="dor-card w-full p-5 md:p-8">
            <StaffComplaintForm />
          </div>
        </div>
      </main>
    </div>
  );
}
