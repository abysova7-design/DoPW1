"use client";

import dynamic from "next/dynamic";

const SanAndreasMap = dynamic(
  () => import("./SanAndreasMap").then((m) => m.SanAndreasMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-2xl border border-[var(--dor-border)]"
        style={{ height: "340px", background: "#0d1117" }}
      />
    ),
  },
);

export function MapClient(
  props: {
    onPick?: (lat: number, lng: number) => void;
    heightClass?: string;
    initialLat?: number;
    initialLng?: number;
    callLat?: number;
    callLng?: number;
    callEndLat?: number;
    callEndLng?: number;
    callLabel?: string;
    dualPick?: boolean;
    pickSlot?: "A" | "B";
    pointA?: { lat: number; lng: number } | null;
    pointB?: { lat: number; lng: number } | null;
  },
) {
  return <SanAndreasMap {...props} />;
}
