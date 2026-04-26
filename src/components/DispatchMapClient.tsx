"use client";

import dynamic from "next/dynamic";
import type { DispatchMapProps } from "./DispatchMap";

const DispatchMap = dynamic(
  () => import("./DispatchMap").then((m) => m.DispatchMap),
  {
    ssr: false,
    loading: () => (
      <div className="dor-card h-[380px] animate-pulse md:h-[480px]" />
    ),
  },
);

export function DispatchMapClient(props: DispatchMapProps) {
  return <DispatchMap {...props} />;
}
