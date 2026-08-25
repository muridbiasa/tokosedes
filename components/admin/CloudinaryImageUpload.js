"use client";

import { CldUploadWidget } from "next-cloudinary";
import { AlertTriangle, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Variabel NEXT_PUBLIC_* di-inline saat build; jika tidak diset, bernilai
// undefined dan komponen menampilkan peringatan konfigurasi (bukan gagal diam).
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

function toImageList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export default function CloudinaryImageUpload({ value = [], onChange, multiple = true, label = "Tambah gambar" }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  // Buffer sinkron: onSuccess widget dipanggil sekali PER BERKAS dalam batch
  // yang sama. Tanpa buffer, setiap panggilan memakai snapshot array lama
  // (stale closure) sehingga hanya berkas terakhir yang tersimpan.
  const imagesRef = useRef(toImageList(value));

  useEffect(() => {
    imagesRef.current = toImageList(value);
  }, [value]);

  const images = toImageList(value);

  function handleSuccess(result) {
    const url = result?.info?.secure_url;
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      setError("Respons upload tidak berisi URL yang valid. Periksa upload preset Cloudinary.");
      return;
    }
    setError("");
    const next = multiple ? [...imagesRef.current, url] : [url];
    imagesRef.current = next;
    onChange(next);
  }

  function handleError(uploadResult) {
    const message =
      uploadResult?.event?.status ||
      uploadResult?.info?.error?.message;
    setError(
      `Upload ke Cloudinary gagal${message ? `: ${message}` : ""}. Pastikan cloud name & upload preset (unsigned) benar.`
    );
  }

  function removeImage(index) {
    const next = images.filter((_, itemIndex) => itemIndex !== index);
    imagesRef.current = next;
    setError("");
    onChange(next);
  }

  const configMissing = !CLOUD_NAME || !UPLOAD_PRESET;

  return (
    <div className="flex flex-col gap-3">
      {configMissing && (
        <p className="flex items-start gap-1.5 rounded-md bg-[var(--marigold)]/15 px-3 py-2 text-xs text-[var(--ink)]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Cloudinary belum dikonfigurasi: set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> dan{" "}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> (preset unsigned), lalu build ulang.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-start gap-1.5 rounded-md border border-[var(--brick)]/40 bg-[var(--brick)]/10 px-3 py-2 text-xs text-[var(--brick)]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      <CldUploadWidget
        // Widget melempar error saat prerender jika cloudName kosong, maka
        // pakai placeholder; tombol tetap dikunci sampai konfigurasi lengkap.
        config={{ cloud: { cloudName: CLOUD_NAME || "missing-cloud-name" } }}
        uploadPreset={UPLOAD_PRESET || "missing-upload-preset"}
        options={{
          multiple,
          maxFiles: multiple ? 8 : 1,
          clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
          maxFileSize: 5 * 1024 * 1024,
          transformation: [{ width: 1600, height: 1600, crop: "limit", fetch_format: "webp", quality: "auto" }],
          sources: ["local", "camera"],
        }}
        onOpen={() => { setIsUploading(true); setError(""); }}
        onClose={() => setIsUploading(false)}
        onSuccess={handleSuccess}
        onError={handleError}
      >
        {({ open }) => (
          <button
            type="button"
            onClick={() => open()}
            disabled={isUploading || configMissing}
            title={configMissing ? "Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME & UPLOAD_PRESET terlebih dahulu" : undefined}
            className="flex items-center gap-2 self-start rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--canvas)] disabled:cursor-not-allowed disabled:opacity-60"
          >
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
              <button type="button" aria-label={`Hapus gambar ${index + 1}`} onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded-full bg-[var(--ink)] p-1 text-[var(--paper)] opacity-0 transition group-hover:opacity-100 focus:opacity-100">
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
  return <CloudinaryImageUpload value={value ? [value] : []} multiple={false} label={label} onChange={(imgs) => onChange(imgs[0] || "")} />;
}
