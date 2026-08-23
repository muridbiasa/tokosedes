"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export default function CloudinaryImageUpload({ value = [], onChange, multiple = true, label = "Tambah gambar" }) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const images = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

  async function handleFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      setError("Konfigurasi upload gambar belum tersedia.");
      return;
    }
    setError("");
    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of files.slice(0, multiple ? 8 : 1)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("folder", "tokosedes");
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Upload gambar gagal.");
        uploaded.push(result.secure_url);
      }
      onChange(multiple ? [...images, ...uploaded] : uploaded);
    } catch (uploadError) {
      console.error("[v0] Cloudinary upload failed", uploadError);
      setError(uploadError.message || "Upload gambar gagal.");
    } finally {
      setIsUploading(false);
    }
  }

  return <div className="flex flex-col gap-3">
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={handleFiles} className="sr-only" />
    <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 self-start rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--canvas)] disabled:opacity-60">
      {isUploading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ImagePlus aria-hidden="true" />}
      {isUploading ? "Mengunggah..." : label}
    </button>
    {error && <p role="alert" className="text-xs text-[var(--brick)]">{error}</p>}
    {images.length > 0 && <div className="grid grid-cols-4 gap-2">{images.map((url, index) => <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--canvas)]"><img src={url} alt={`Gambar produk ${index + 1}`} className="size-full object-cover" /><button type="button" aria-label={`Hapus gambar ${index + 1}`} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-full bg-[var(--ink)] p-1 text-[var(--paper)] opacity-0 transition group-hover:opacity-100 focus:opacity-100"><X aria-hidden="true" /></button></div>)}</div>}
  </div>;
}

export function CloudinarySingleImageUpload({ value = "", onChange, label = "Tambah gambar varian" }) {
  return <CloudinaryImageUpload value={value ? [value] : []} multiple={false} label={label} onChange={(images) => onChange(images[0] || "")} />;
}
