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

function clampCoord(lat: number, lng: number): [number, number] {
  return [
    Math.max(0, Math.min(IMG_SIZE, lat)),
    Math.max(0, Math.min(IMG_SIZE, lng)),
  ];
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

function DualClickMarkers({
  onPick,
  pointA,
  pointB,
  pickSlot,
}: {
  onPick: (lat: number, lng: number) => void;
  pointA: { lat: number; lng: number } | null;
  pointB: { lat: number; lng: number } | null;
  pickSlot: "A" | "B";
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });

  const iconA = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:999px;background:#e85d04;border:3px solid #fff;box-shadow:0 0 0 3px rgba(232,93,4,.4);position:relative">
      <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;white-space:nowrap">А · забрать</div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  const iconB = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:999px;background:#22c55e;border:3px solid #fff;box-shadow:0 0 0 3px rgba(34,197,94,.4);position:relative">
      <div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;font-size:10px;padding:1px 6px;border-radius:4px;white-space:nowrap">Б · доставить</div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  return (
    <>
      {pointA ? <Marker position={[pointA.lat, pointA.lng]} icon={iconA} /> : null}
      {pointB ? <Marker position={[pointB.lat, pointB.lng]} icon={iconB} /> : null}
    </>
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
  dualPick = false,
  pickSlot = "A",
  pointA = null,
  pointB = null,
}: {
  onPick?: (lat: number, lng: number) => void;
  heightClass?: string;
  initialLat?: number;
  initialLng?: number;
  callLat?: number;
  callLng?: number;
  callLabel?: string;
  dualPick?: boolean;
  pickSlot?: "A" | "B";
  pointA?: { lat: number; lng: number } | null;
  pointB?: { lat: number; lng: number } | null;
}) {
  const [pos, setPos] = useState<[number, number] | null>(
    !dualPick && initialLat != null && initialLng != null ? [initialLat, initialLng] : null,
  );

  useEffect(() => {
    if (dualPick) return;
    if (initialLat != null && initialLng != null && pos === null) {
      setPos([initialLat, initialLng]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng, dualPick]);

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      const [clampedLat, clampedLng] = clampCoord(lat, lng);
      if (!dualPick) {
        setPos([clampedLat, clampedLng]);
      }
      onPick?.(clampedLat, clampedLng);
    },
    [onPick, dualPick],
  );

  const hint = dualPick
    ? pickSlot === "A"
      ? "Клик — точка А (забор груза). Переключите на Б для точки доставки."
      : "Клик — точка Б (куда доставить)."
    : "Кликните на карту, чтобы отметить свою точку";

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
        {dualPick ? (
          <DualClickMarkers
            onPick={handlePick}
            pointA={pointA}
            pointB={pointB}
            pickSlot={pickSlot}
          />
        ) : (
          <ClickMarker onPick={handlePick} pos={pos} />
        )}
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
        {hint}
      </div>

      {!dualPick && pos && (
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
      {dualPick && (pointA || pointB) ? (
        <div
          className="pointer-events-none absolute right-2 top-2 max-w-[200px] rounded-lg font-mono text-[10px]"
          style={{
            background: "rgba(0,0,0,.7)",
            padding: "4px 8px",
            color: "#e5e7eb",
          }}
        >
          {pointA ? (
            <div>
              А: {Math.round(pointA.lng)}, {Math.round(IMG_SIZE - pointA.lat)}
            </div>
          ) : null}
          {pointB ? (
            <div>
              Б: {Math.round(pointB.lng)}, {Math.round(IMG_SIZE - pointB.lat)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
