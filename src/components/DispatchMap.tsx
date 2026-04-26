"use client";

import { useEffect, type ReactElement } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

const SA_MAP = "/sa_map.jpg";
const IMG_SIZE = 6000;
const BOUNDS: L.LatLngBoundsExpression = [
  [0, 0],
  [IMG_SIZE, IMG_SIZE],
];

function InitMap() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.fitBounds(BOUNDS, { animate: false, padding: [0, 0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function escAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function checkpointPin(
  label: string,
  variant: "fixed" | "temp",
  options?: { staffed?: boolean; hoverTitle?: string },
) {
  const staffed = Boolean(options?.staffed);
  const bg = variant === "temp" ? "#a855f7" : staffed ? "#22c55e" : "#f59e0b";
  const tip = options?.hoverTitle?.trim() ? escAttr(options.hoverTitle.trim()).slice(0, 420) : "";
  const titleAttr = tip ? ` title="${tip}"` : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:18px;height:18px"${titleAttr}>
      <div style="width:18px;height:18px;border-radius:4px;transform:rotate(45deg);
        background:${bg};border:2px solid #fff;
        box-shadow:0 0 0 2px rgba(0,0,0,.4)"></div>
      <span style="
        position:absolute;bottom:20px;left:50%;transform:translateX(-50%);
        white-space:nowrap;background:rgba(0,0,0,.85);color:#fff;
        font-size:9px;padding:1px 5px;border-radius:4px;pointer-events:none;max-width:140px;overflow:hidden;text-overflow:ellipsis
      ">${label.replace(/</g, "")}</span>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function workerPin(color: string, label?: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:16px;height:16px">
      <div style="width:16px;height:16px;border-radius:999px;
        background:${color};border:2px solid #fff;
        box-shadow:0 0 0 2px rgba(0,0,0,.45)"></div>
      ${label ? `<span style="
        position:absolute;bottom:18px;left:50%;transform:translateX(-50%);
        white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;
        font-size:10px;padding:1px 5px;border-radius:4px;pointer-events:none
      ">${label}</span>` : ""}
    </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function callPin() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:20px;height:20px">
      <div style="width:20px;height:20px;border-radius:999px;
        background:#40916c;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(64,145,108,.5)"></div>
      <span style="
        position:absolute;bottom:22px;left:50%;transform:translateX(-50%);
        white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;
        font-size:10px;padding:1px 6px;border-radius:4px;pointer-events:none
      ">📍 вызов</span>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function ClickLayer({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      const lat = Math.max(0, Math.min(IMG_SIZE, e.latlng.lat));
      const lng = Math.max(0, Math.min(IMG_SIZE, e.latlng.lng));
      onPick?.(lat, lng);
    },
  });
  return null;
}

export type WorkerMarker = {
  userId: string;
  nickname: string;
  lat: number;
  lng: number;
  stale?: boolean;
  evacuating?: boolean;
  /** Дорожный патруль — розовая точка */
  roadPatrol?: boolean;
};

export type CheckpointMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  variant?: "fixed" | "temp";
  /** id стационарного поста из PATROL_CHECKPOINTS (1–3) */
  stationaryCheckpointId?: number;
  occupants?: { nickname: string; displayName?: string | null }[];
  /** Временный КП: убрать маркер с карты */
  onClearTemp?: () => void;
};

export type CheckpointMapActions = {
  myCheckpointId: number | null;
  busy: boolean;
  onTake: (checkpointId: number) => void;
  onLeave: () => void;
};

export type ClosureMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description?: string | null;
};

/** Отчёты дорожного патруля с координатами */
export type PatrolReportMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
};

function patrolReportPin(label: string) {
  const safe = label.replace(/</g, "").slice(0, 48);
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:20px;height:20px">
      <div style="width:20px;height:20px;border-radius:999px;
        background:#0891b2;border:3px solid #fff;
        box-shadow:0 0 0 3px rgba(8,145,178,.45)"></div>
      <span style="
        position:absolute;bottom:22px;left:50%;transform:translateX(-50%);
        white-space:nowrap;background:rgba(0,0,0,.88);color:#fff;
        font-size:9px;padding:2px 6px;border-radius:4px;pointer-events:none;max-width:180px;overflow:hidden;text-overflow:ellipsis
      ">🛣️ ${safe}</span>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function closurePin(title: string) {
  const safe = title.replace(/</g, "").slice(0, 40);
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px">
      <div style="width:22px;height:22px;border-radius:3px;transform:rotate(45deg);
        background:repeating-linear-gradient(-45deg,#f97316,#f97316 3px,#fef08a 3px,#fef08a 6px);
        border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.5)"></div>
      <span style="
        position:absolute;bottom:24px;left:50%;transform:translateX(-50%);
        white-space:nowrap;background:rgba(0,0,0,.88);color:#fff;
        font-size:9px;padding:2px 6px;border-radius:4px;pointer-events:none;max-width:160px;overflow:hidden;text-overflow:ellipsis
      ">⛔ ${safe}</span>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export type DispatchMapProps = {
  workers?: WorkerMarker[];
  callMarkers?: {
    id: string;
    lat: number;
    lng: number;
    title?: string;
    endLat?: number | null;
    endLng?: number | null;
  }[];
  checkpointMarkers?: CheckpointMarker[];
  closureMarkers?: ClosureMarker[];
  patrolReportMarkers?: PatrolReportMarker[];
  /** Кнопки заступления на стационарный КП (только дорожный патруль) */
  checkpointActions?: CheckpointMapActions;
  onPick?: (lat: number, lng: number) => void;
  pickedLat?: number | null;
  pickedLng?: number | null;
  heightClass?: string;
};

export function DispatchMap({
  workers = [],
  callMarkers = [],
  checkpointMarkers = [],
  closureMarkers = [],
  patrolReportMarkers = [],
  checkpointActions,
  onPick,
  pickedLat,
  pickedLng,
  heightClass = "h-[380px] md:h-[480px]",
}: DispatchMapProps) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-[var(--dor-border)] ${heightClass}`}
      style={{ background: "#0d1117" }}
    >
      <MapContainer
        crs={L.CRS.Simple}
        center={[IMG_SIZE / 2, IMG_SIZE / 2]}
        zoom={-3}
        minZoom={-4}
        maxZoom={2}
        scrollWheelZoom
        doubleClickZoom={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%", background: "#0d1117" }}
      >
        <InitMap />
        <ImageOverlay url={SA_MAP} bounds={BOUNDS} />
        <ClickLayer onPick={onPick} />

        {checkpointMarkers.map((cp) => {
          const variant = cp.variant ?? "fixed";
          const occ = cp.occupants ?? [];
          const staffed = variant === "fixed" && occ.length > 0;
          const hoverTitle =
            staffed
              ? `На посту: ${occ.map((o) => o.displayName ?? o.nickname).join(", ")}`
              : cp.label;
          return (
            <Marker
              key={cp.id}
              position={[cp.lat, cp.lng]}
              icon={checkpointPin(cp.label, variant, {
                staffed,
                hoverTitle: variant === "fixed" ? hoverTitle : cp.label,
              })}
            >
              <Popup>
                <div className="min-w-[168px] space-y-2 text-sm text-[var(--dor-text)]">
                  <div>
                    <div className="font-semibold">{cp.label}</div>
                    {variant === "temp" ? (
                      <p className="mt-1 text-xs text-[var(--dor-muted)]">
                        Метка для коллег и диспетчера. Можно снять кнопкой ниже.
                      </p>
                    ) : occ.length > 0 ? (
                      <div className="mt-1 text-xs text-[var(--dor-muted)]">
                        На посту: {occ.map((o) => o.displayName ?? o.nickname).join(", ")}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-[var(--dor-muted)]">Пост свободен</div>
                    )}
                  </div>
                  {variant === "temp" && cp.onClearTemp ? (
                    <div className="border-t border-[var(--dor-border)] pt-2">
                      <button
                        type="button"
                        className="w-full rounded-lg bg-[var(--dor-surface)] px-2 py-1.5 text-xs font-medium hover:opacity-90"
                        onClick={() => cp.onClearTemp?.()}
                      >
                        Снять временный КП с карты
                      </button>
                    </div>
                  ) : null}
                  {checkpointActions && cp.stationaryCheckpointId != null ? (
                    <div className="flex flex-col gap-1 border-t border-[var(--dor-border)] pt-2">
                      {checkpointActions.myCheckpointId === cp.stationaryCheckpointId ? (
                        <button
                          type="button"
                          className="rounded-lg bg-[var(--dor-surface)] px-2 py-1.5 text-xs font-medium hover:opacity-90"
                          disabled={checkpointActions.busy}
                          onClick={() => checkpointActions.onLeave()}
                        >
                          Сняться с поста
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg bg-[var(--dor-orange)] px-2 py-1.5 text-xs font-medium text-black hover:opacity-90"
                          disabled={checkpointActions.busy}
                          onClick={() => checkpointActions.onTake(cp.stationaryCheckpointId!)}
                        >
                          {checkpointActions.myCheckpointId != null
                            ? "Перейти на этот пост"
                            : "Заступить на пост"}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {workers.map((w) => {
          const color = w.stale
            ? "#8b949e"
            : w.roadPatrol
              ? "#ec4899"
              : w.evacuating
                ? "#3b82f6"
                : "#e85d04";
          const tag = w.roadPatrol ? "патруль" : w.evacuating ? "эвакуация" : undefined;
          return (
          <Marker
            key={w.userId}
            position={[w.lat, w.lng]}
            icon={workerPin(color, tag ? `${w.nickname} · ${tag}` : w.nickname)}
          >
            <Popup>
              <strong>{w.nickname}</strong>
              {w.stale
                ? " · данные устарели"
                : w.roadPatrol
                  ? " · дорожный патруль"
                  : w.evacuating
                    ? " · ведёт эвакуацию"
                    : " · онлайн"}
            </Popup>
          </Marker>
          );
        })}

        {pickedLat != null && pickedLng != null && (
          <Marker position={[pickedLat, pickedLng]} icon={callPin()} />
        )}

        {patrolReportMarkers.map((pr) => (
          <Marker key={pr.id} position={[pr.lat, pr.lng]} icon={patrolReportPin(pr.label)}>
            <Popup>
              <div style={{ fontWeight: 600, fontSize: "12px" }}>{pr.label}</div>
            </Popup>
          </Marker>
        ))}

        {callMarkers.flatMap((c) => {
          const hasEnd =
            c.endLat != null &&
            c.endLng != null &&
            Number.isFinite(c.endLat) &&
            Number.isFinite(c.endLng);
          const line =
            hasEnd ? (
              <Polyline
                key={`${c.id}-route`}
                positions={[
                  [c.lat, c.lng],
                  [c.endLat as number, c.endLng as number],
                ]}
                pathOptions={{ color: "#22c55e", weight: 3, opacity: 0.75 }}
              />
            ) : null;
          const m1 = (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={L.divIcon({
                className: "",
                html: `<div style="position:relative;width:20px;height:20px">
                <div style="width:20px;height:20px;border-radius:999px;
                  background:#dc2626;border:3px solid #fff;
                  box-shadow:0 0 0 3px rgba(220,38,38,.45)"></div>
                <span style="
                  position:absolute;bottom:22px;left:50%;transform:translateX(-50%);
                  white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;
                  font-size:10px;padding:1px 6px;border-radius:4px;pointer-events:none
                ">${hasEnd ? "вызов А" : "вызов"}</span>
              </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })}
            >
              <Popup>{c.title ?? "Вызов"}</Popup>
            </Marker>
          );
          const m2 =
            hasEnd ? (
              <Marker
                key={`${c.id}-b`}
                position={[c.endLat as number, c.endLng as number]}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="position:relative;width:20px;height:20px">
                <div style="width:20px;height:20px;border-radius:999px;
                  background:#22c55e;border:3px solid #fff;
                  box-shadow:0 0 0 3px rgba(34,197,94,.45)"></div>
                <span style="
                  position:absolute;bottom:22px;left:50%;transform:translateX(-50%);
                  white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;
                  font-size:10px;padding:1px 6px;border-radius:4px;pointer-events:none
                ">вызов Б</span>
              </div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <Popup>{(c.title ?? "Вызов") + " — точка Б"}</Popup>
              </Marker>
            ) : null;
          return [line, m1, m2].filter(Boolean) as ReactElement[];
        })}

        {closureMarkers.map((cl) => (
          <Marker key={cl.id} position={[cl.lat, cl.lng]} icon={closurePin(cl.title)}>
            <Popup>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>⛔ {cl.title}</div>
              {cl.description ? (
                <div style={{ marginTop: "6px", maxWidth: "220px", fontSize: "11px", color: "#8b949e" }}>
                  {cl.description}
                </div>
              ) : null}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div
        className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center"
      >
        <span style={{
          background: "rgba(0,0,0,.65)",
          borderRadius: "8px",
          padding: "2px 10px",
          fontSize: "10px",
          color: "var(--dor-muted)",
        }}>
          🟠 сотрудники · 🩷 патруль · 🔵 эвакуация · 🟢 точка вызова/отчёта · 🛣️ отчёт патруля · 🔴/🟢 вызов+маршрут · 🟧 КП свободен · 🟩 КП заступили · 🟣 вр. КП · ⛔ перекрытие
        </span>
      </div>
    </div>
  );
}
