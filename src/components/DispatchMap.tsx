"use client";

import { useEffect } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
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
};

export type DispatchMapProps = {
  workers?: WorkerMarker[];
  callMarkers?: { id: string; lat: number; lng: number; title?: string }[];
  onPick?: (lat: number, lng: number) => void;
  pickedLat?: number | null;
  pickedLng?: number | null;
  heightClass?: string;
};

export function DispatchMap({
  workers = [],
  callMarkers = [],
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

        {workers.map((w) => (
          <Marker
            key={w.userId}
            position={[w.lat, w.lng]}
            icon={workerPin(w.stale ? "#8b949e" : w.evacuating ? "#3b82f6" : "#e85d04", w.nickname)}
          >
            <Popup>
              <strong>{w.nickname}</strong>
              {w.stale
                ? " · данные устарели"
                : w.evacuating
                  ? " · ведет эвакуацию"
                  : " · онлайн"}
            </Popup>
          </Marker>
        ))}

        {pickedLat != null && pickedLng != null && (
          <Marker position={[pickedLat, pickedLng]} icon={callPin()} />
        )}
        {callMarkers.map((c) => (
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
                ">вызов</span>
              </div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <Popup>{c.title ?? "Вызов"}</Popup>
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
          🟠 сотрудники · 🔵 активная эвакуация · 🔴 активный вызов · 🟢 новая точка вызова
        </span>
      </div>
    </div>
  );
}
