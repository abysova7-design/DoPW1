"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

const SA_MAP = "/sa_map.jpg";

// Реальный размер изображения 6000×6000
// В CRS.Simple: lat = Y (снизу вверх), lng = X (слева направо)
const IMG_SIZE = 6000;
const BOUNDS: L.LatLngBoundsExpression = [
  [0, 0],
  [IMG_SIZE, IMG_SIZE],
];

function InitMap() {
  const map = useMap();
  useEffect(() => {
    // invalidateSize — сначала чтобы контейнер знал свой размер,
    // затем fitBounds БЕЗ padding чтобы координаты совпадали с кликом
    map.invalidateSize();
    map.fitBounds(BOUNDS, { animate: false, padding: [0, 0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ClickMarker({
  onPick,
  pos,
}: {
  onPick: (lat: number, lng: number) => void;
  pos: [number, number] | null;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!pos) return null;

  return (
    <Marker
      position={pos}
      icon={L.divIcon({
        className: "",
        html: `<div style="
          width:18px;height:18px;border-radius:999px;
          background:#e85d04;border:3px solid #fff;
          box-shadow:0 0 0 3px rgba(232,93,4,.4);
          position:relative;
        ">
          <div style="
            position:absolute;top:-22px;left:50%;transform:translateX(-50%);
            background:rgba(0,0,0,.75);color:#fff;font-size:10px;
            padding:1px 6px;border-radius:4px;white-space:nowrap;
          ">Вы здесь</div>
        </div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })}
    />
  );
}

export function SanAndreasMap({
  onPick,
  heightClass = "h-[340px] md:h-[440px]",
  initialLat,
  initialLng,
  callLat,
  callLng,
  callLabel = "Вызов",
}: {
  onPick?: (lat: number, lng: number) => void;
  heightClass?: string;
  initialLat?: number;
  initialLng?: number;
  callLat?: number;
  callLng?: number;
  callLabel?: string;
}) {
  const [pos, setPos] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null,
  );

  // Когда с сервера приходит последняя сохранённая точка — показываем её
  useEffect(() => {
    if (initialLat != null && initialLng != null && pos === null) {
      setPos([initialLat, initialLng]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng]);

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      // Зажимаем координаты в пределах карты
      const clampedLat = Math.max(0, Math.min(IMG_SIZE, lat));
      const clampedLng = Math.max(0, Math.min(IMG_SIZE, lng));
      setPos([clampedLat, clampedLng]);
      onPick?.(clampedLat, clampedLng);
    },
    [onPick],
  );

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
        <ClickMarker onPick={handlePick} pos={pos} />
        {callLat != null && callLng != null && (
          <Marker
            position={[callLat, callLng]}
            icon={L.divIcon({
              className: "",
              html: `<div style="
                width:18px;height:18px;border-radius:999px;
                background:#dc2626;border:3px solid #fff;
                box-shadow:0 0 0 3px rgba(220,38,38,.4);
                position:relative;
              ">
                <div style="
                  position:absolute;top:-22px;left:50%;transform:translateX(-50%);
                  background:rgba(0,0,0,.75);color:#fff;font-size:10px;
                  padding:1px 6px;border-radius:4px;white-space:nowrap;
                ">${callLabel}</div>
              </div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            })}
          />
        )}
      </MapContainer>

      <div
        className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg text-center"
        style={{
          background: "rgba(0,0,0,.6)",
          padding: "3px 8px",
          fontSize: "11px",
          color: "var(--dor-muted)",
        }}
      >
        Кликните на карту, чтобы отметить свою точку
      </div>

      {pos && (
        <div
          className="pointer-events-none absolute right-2 top-2 rounded-lg font-mono"
          style={{
            background: "rgba(0,0,0,.7)",
            padding: "2px 8px",
            fontSize: "10px",
            color: "var(--dor-orange, #e85d04)",
          }}
        >
          {Math.round(pos[1])}, {Math.round(IMG_SIZE - pos[0])}
        </div>
      )}
    </div>
  );
}
