"use client";

import { useEffect, useRef } from "react";

export function PublicGallery() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const imgs = root.querySelectorAll("img");
    const cleanups: (() => void)[] = [];
    imgs.forEach((img) => {
      const hide = () => {
        img.style.display = "none";
      };
      img.addEventListener("error", hide, { once: true });
      cleanups.push(() => img.removeEventListener("error", hide));
    });
    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div
      ref={wrapRef}
      className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={`/gallery/work${i + 1}.jpg`}
          alt={`Работа ${i + 1}`}
          className="dor-card aspect-video w-full object-cover"
        />
      ))}
    </div>
  );
}
