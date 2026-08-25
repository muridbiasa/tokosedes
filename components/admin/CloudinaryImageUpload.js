"use client";

import { AlertTriangle, ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
// Variabel NEXT_PUBLIC_* di-inline saat build; jika tidak diset, bernilai
// kosong dan komponen menampilkan peringatan konfigurasi (bukan gagal diam-diam).
const CLOUD_NAME = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "").trim();
const UPLOAD_PRESET = (process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "").trim();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 10;

function toImageList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

/**
 * Konversi berkas gambar menjadi WebP maksimal 1600px di sisi browser,
 * lalu hasilnya yang dikirim ke Cloudinary (menggantikan transformasi
 * eager milik widget lama).
 */
function fileToWebpBlob(file, maxSize = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("Konversi WebP gagal"));
          },
          "image/webp",
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Format gambar tidak dikenali browser"));
    };
    img.src = url;
  });
}

/**
 * Unggah langsung (unsigned upload) ke Cloudinary REST API.
 * Tidak bergantung pada skrip widget eksternal sehingga bebas dari
 * kegagalan inisialisasi widget (error "reading 'open'").
 */
async function uploadToCloudinary(blob, fileName) {
  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  let data = null;
  try { data = await res.json(); } catch { /* respons non-JSON */ }

  if (!res.ok) {
    const detail = data?.error?.message ? ` (${data.error.message})` : "";
    throw new Error(`Cloudinary menolak berkas${detail}`);
  }
  if (!data?.secure_url || typeof data.secure_url !== "string") {
    throw new Error("Respons Cloudinary tidak berisi URL yang valid");
  }
  return data.secure_url;
}

export default function CloudinaryImageUpload({ value = [], onChange, multiple = true, label = "Tambah gambar" }) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState([]);
  // Buffer sinkron agar urutan & isi array akurat saat beberapa berkas
  // diproses berturut-turut dalam satu batch pilihan.
  const imagesRef = useRef(toImageList(value));
  const inputRef = useRef(null);

  useEffect(() => {
    imagesRef.current = toImageList(value);
  }, [value]);

  const images = toImageList(value);
  const configMissing = !CLOUD_NAME || !UPLOAD_PRESET;

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length || isUploading) return;

    setIsUploading(true);
    setErrors([]);

    // Bekerja pada salinan lokal, sinkron dengan imagesRef tiap sukses.
    let current = [...imagesRef.current];
    const failures = [];
    const total = multiple ? files.length : 1;
    const queue = multiple ? files : [files[0]];

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      const tag = total > 1 ? `${i + 1}/${total} · ` : "";
      setProgress(`Mengunggah ${tag}${file.name}`);

      try {
        if (!(ALLOWED_TYPES.includes(file.type) || file.type === "")) {
          throw new Error("Hanya JPG, PNG, atau WebP yang didukung");
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(`Ukuran melebihi ${MAX_FILE_MB} MB`);
        }

        const webp = await fileToWebpBlob(file);
        const baseName = file.name.replace(/\.[^.]+$/, "") || "gambar";
        const url = await uploadToCloudinary(webp, `${baseName}.webp`);

        if (multiple) {
          current = [...current, url];
        } else {
          current = [url];
        }
        imagesRef.current = current;
        onChange(current);
      } catch (err) {
        failures.push(`${file.name}: ${err.message}`);
      }
    }

    setErrors(failures);
    setProgress("");
    setIsUploading(false);
  }

  function removeImage(index) {
    const next = images.filter((_, itemIndex) => itemIndex !== index);
    imagesRef.current = next;
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {configMissing && (
        <p className="flex items-start gap-1.5 rounded-md bg-[var(--marigold)]/15 px-3 py-2 text-xs text-[var(--ink)]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Cloudinary belum dikonfigurasi: set <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> dan{" "}
          <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> (preset <em>unsigned</em>), lalu build ulang.
        </p>
      )}
      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-[var(--brick)]/40 bg-[var(--brick)]/10 px-3 py-2 text-xs text-[var(--brick)]">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = ""; // izinkan memilih berkas yang sama lagi
        }}
      />
      <button
        type="button"
        disabled={isUploading || configMissing}
        title={configMissing ? "Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME & UPLOAD_PRESET terlebih dahulu" : undefined}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 self-start rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold hover:bg-[var(--canvas)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {isUploading ? progress || "Mengunggah..." : label}
      </button>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-md border border-[var(--line)] bg-[var(--canvas)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Gambar produk ${index + 1}`} className="size-full object-cover" />
              <button type="button" aria-label={`Hapus gambar ${index + 1}`} onClick={() => removeImage(index)} className="absolute right-1 top-1 rounded-full bg-[var(--ink)] p-1 text-[var(--paper)] opacity-0 transition group-hover:opacity-100 focus:opacity-100">
                <X size={12} />
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
