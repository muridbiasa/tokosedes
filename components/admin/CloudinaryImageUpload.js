"use client";

import { CldUploadWidget } from "next-cloudinary";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useState } from "react";

export default function CloudinaryImageUpload({ value = [], onChange, multiple = true, label = "Tambah gambar" }) {
  const [isUploading, setIsUploading] = useState(false);
  const images = Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

  function handleSuccess(result) {
    const url = result?.info?.secure_url;
    if (!url) return;
    onChange(multiple ? [...images, url] : [url]);
  }

  return (
    <div className="flex flex-col gap-3">
      <CldUploadWidget
        config={{ cloud: { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "pqrglbhd" } }}
        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "toko_sedes"}
        onError={(error) => {
          console.error("[v0] Cloudinary upload failed", error);
          setIsUploading(false);
        }}
        options={{
          multiple,
          maxFiles: multiple ? 8 : 1,
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 5 * 1024 * 1024,
          transformation: [{ width: 1600, height: 1600, crop: "limit", fetch_format: "webp", quality: "auto" }],
          sources: ["local", "camera"],
        }}
        onOpen={() => setIsUploading(true)}
        onClose={() => setIsUploading(false)}
        onSuccess={handleSuccess}
      >
        {({ open }) => (
          <button type="button" onClick={() => open?.()} disabled={isUploading || !open} className="flex items-center gap-2 self-start rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--canvas)] disabled:opacity-60">
            {isUploading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <ImagePlus data-icon="inline-start" />}
            {isUploading ? "Mengunggah..." : label}
          </button>
        )}
      </CldUploadWidget>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--canvas)]">
              <img src={url} alt={`Gambar produk ${index + 1}`} className="size-full object-cover" />
              <button type="button" aria-label={`Hapus gambar ${index + 1}`} onClick={() => onChange(images.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded-full bg-[var(--ink)] p-1 text-[var(--paper)] opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                <X data-icon="inline-start" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CloudinarySingleImageUpload({ value = "", onChange, label = "Tambah gambar varian" }) {
  return <CloudinaryImageUpload value={value ? [value] : []} multiple={false} label={label} onChange={(images) => onChange(images[0] || "")} />;
}
