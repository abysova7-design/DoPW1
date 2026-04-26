"use client";

import { useCallback, useEffect, useState } from "react";

type VA = {
  id: string;
  cid: string;
  vehicleName: string;
  photoUrl: string | null;
  assignedAt: string;
};

/** Только просмотр — для личного кабинета сотрудника */
export function VehicleAssignments({ userId }: { userId: string }) {
  const [vehicles, setVehicles] = useState<VA[]>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/vehicles/assigned?userId=${userId}`);
    if (!r.ok) return;
    setVehicles((await r.json()).vehicles ?? []);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-[var(--dor-muted)]">
        За вами нет закреплённых транспортных средств. Обратитесь к администратору.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
      {vehicles.map((v) => (
        <div
          key={v.id}
          className="overflow-hidden rounded-2xl border border-[var(--dor-border)] bg-[var(--dor-night)]"
        >
          {v.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.photoUrl}
              alt={v.vehicleName}
              className="h-32 w-full object-cover"
            />
          )}
          <div className="p-3">
            <div className="font-semibold">{v.vehicleName}</div>
            <div className="mt-0.5 font-mono text-sm text-[var(--dor-orange)]">
              cID: {v.cid}
            </div>
            <div className="mt-1 text-xs text-[var(--dor-muted)]">
              Закреплено {new Date(v.assignedAt).toLocaleDateString("ru-RU")}
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[var(--dor-border)] p-4 text-xs text-[var(--dor-muted)]">
        {vehicles.length} / 3 слота
      </div>
    </div>
  );
}
