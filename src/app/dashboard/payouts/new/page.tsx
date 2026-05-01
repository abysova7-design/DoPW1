import { Suspense } from "react";
import NewPayoutClient from "./NewPayoutClient";

export default function NewPayoutPage() {
  return (
    <Suspense
      fallback={
        <div className="dor-stripes flex min-h-screen items-center justify-center text-[var(--dor-muted)]">
          Загрузка…
        </div>
      }
    >
      <NewPayoutClient />
    </Suspense>
  );
}
