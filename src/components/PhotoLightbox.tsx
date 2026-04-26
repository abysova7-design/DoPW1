"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function PhotoLightbox({
  photos,
  startIndex = 0,
  onClose,
}: {
  photos: string[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, photos.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,.92)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      {/* Закрыть */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(255,255,255,.1)", border: "none",
          color: "#fff", fontSize: 24, cursor: "pointer",
          borderRadius: 8, padding: "4px 10px", lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Счётчик */}
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        color: "rgba(255,255,255,.6)", fontSize: 13 }}>
        {idx + 1} / {photos.length}
      </div>

      {/* Фото */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[idx]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw", maxHeight: "80vh",
          borderRadius: 12, boxShadow: "0 0 60px rgba(0,0,0,.6)",
          objectFit: "contain",
        }}
      />

      {/* Стрелки */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            disabled={idx === 0}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(i - 1, 0)); }}
            style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,.12)", border: "none", color: "#fff",
              fontSize: 28, cursor: "pointer", borderRadius: 8,
              padding: "8px 14px", opacity: idx === 0 ? 0.3 : 1,
            }}
          >
            ‹
          </button>
          <button
            type="button"
            disabled={idx === photos.length - 1}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(i + 1, photos.length - 1)); }}
            style={{
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
              background: "rgba(255,255,255,.12)", border: "none", color: "#fff",
              fontSize: 28, cursor: "pointer", borderRadius: 8,
              padding: "8px 14px", opacity: idx === photos.length - 1 ? 0.3 : 1,
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Миниатюры */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}
          onClick={(e) => e.stopPropagation()}>
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={p}
              alt=""
              onClick={() => setIdx(i)}
              style={{
                width: 56, height: 40, objectFit: "cover", borderRadius: 6, cursor: "pointer",
                border: i === idx ? "2px solid #e85d04" : "2px solid transparent",
                opacity: i === idx ? 1 : 0.55,
                transition: "opacity .15s",
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
