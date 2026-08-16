"use client";

import { useState, useEffect } from "react";
import { ImageOff } from "lucide-react";
import { convertDriveLinkToDirectUrl } from "@/lib/driveImageConverter";

/**
 * components/shared/DriveImage.js
 *
 * <img> pintar: otomatis convert link Drive lewat driveImageConverter,
 * dan fallback ke placeholder jika gambar gagal dimuat (link private/
 * restricted/format salah) — sesuai edge case 5.3 PRD.
 *
 * Props:
 *  - src: string (link Drive atau URL gambar biasa)
 *  - alt: string
 *  - className: string
 *  - onStatusChange?: (status: 'ok' | 'error') => void
 *      Dipakai parent untuk menampilkan banner peringatan
 *      "Akses file Drive belum diset Publik".
 */
export default function DriveImage({ src, alt = "", className = "", onStatusChange }) {
  const [failed, setFailed] = useState(false);
  const { url, isValid } = convertDriveLinkToDirectUrl(src);

  useEffect(() => {
    setFailed(false); // reset setiap kali src berubah
  }, [src]);

  const showPlaceholder = !url || !isValid || failed;

  useEffect(() => {
    onStatusChange?.(showPlaceholder ? "error" : "ok");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlaceholder]);

  if (showPlaceholder) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-[var(--canvas)] border border-dashed border-[var(--line)] text-[var(--muted)] ${className}`}
      >
        <ImageOff size={20} strokeWidth={1.5} />
        <span className="text-[11px] text-center px-2">Gambar tidak tersedia</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
