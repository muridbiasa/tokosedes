"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DriveImage from "../shared/DriveImage";

export default function LivePreview({ product = {}, fields = [], settings = {} }) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variant = product.has_variants && variants.length ? variants[Math.min(selectedVariant, variants.length - 1)] : null;
  const images = useMemo(() => [...new Set([variant?.image_url, variant?.imageUrl, ...(product.images || [])].filter(Boolean))], [variant?.image_url, variant?.imageUrl, product.images]);

  useEffect(() => { setSelectedVariant(0); setImageIndex(0); }, [product.name, product.images, product.variants]);
  useEffect(() => { if (imageIndex >= images.length) setImageIndex(0); }, [imageIndex, images.length]);

  const price = variant?.price ?? product.selling_price ?? product.base_price ?? product.price ?? 0;
  const accent = settings.themeColor || settings.theme_color || "#F2A93B";
  const headerMode = settings.headerMode || settings.header_mode || "solid";
  const headerValue = settings.headerValue || settings.header_value || "";
  const headerStyle = headerMode === "image" && headerValue
    ? { backgroundImage: `url(${headerValue})`, backgroundSize: "cover", backgroundPosition: "center" }
    : headerMode === "gradient" && headerValue
      ? { background: headerValue }
      : { background: accent };
  const visibleFields = Array.isArray(fields) ? fields.filter((field) => field?.label || field?.name) : [];
  const gridClass = settings.catalogGridSize === "small" ? "grid-cols-3" : settings.catalogGridSize === "large" ? "grid-cols-1" : "grid-cols-2";

  return <div className="mx-auto w-[300px]" style={{ fontFamily: settings.fontFamily || "sans-serif" }}>
    <div className="rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--ink)] shadow-xl">
      <div className="flex h-5 items-center justify-center"><div className="h-1 w-10 rounded-full bg-[var(--paper)]/30" /></div>
      <div className="h-[560px] overflow-y-auto rounded-b-[1.6rem] bg-[var(--paper)]">
        <header className="px-4 py-5 text-center text-[var(--paper)]" style={headerStyle}>
          <p className="text-[10px] tracking-widest opacity-80">{settings.isStoreOpen === false ? "TOKO SEDANG TUTUP" : "ETALASE TOKO"}</p>
          <h3 className="mt-1 text-base font-semibold">{settings.storeName || "Nama toko"}</h3>
        </header>
        <div className="border-b border-dashed border-[var(--line)] px-4 py-3"><p className="text-xs text-[var(--muted)]">{settings.isStoreOpen === false ? (settings.closedMessage || "Maaf, toko sedang tutup.") : (settings.description || "Selamat datang di toko kami.")}</p></div>
        <div className="relative aspect-square w-full bg-[var(--canvas)]">{images.length ? <DriveImage src={images[imageIndex % images.length]} alt={product.name || "Produk"} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-xs text-[var(--muted)]">Pratinjau gambar produk</div>}{images.length > 1 && <><button type="button" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 rounded-full bg-[var(--paper)]/80 p-1" aria-label="Gambar sebelumnya"><ChevronLeft /></button><button type="button" onClick={() => setImageIndex((imageIndex + 1) % images.length)} className="absolute right-2 top-1/2 rounded-full bg-[var(--paper)]/80 p-1" aria-label="Gambar berikutnya"><ChevronRight /></button></>}</div>
        <div className="flex flex-col gap-4 p-4"><div><h3 className="font-display text-base font-semibold text-[var(--ink)]">{product.name || "Nama produk"}</h3><p className="mt-1 text-xs text-[var(--muted)]">{product.description || "Deskripsi produk akan tampil di sini."}</p></div><p className="font-mono text-lg font-semibold text-[var(--ink)]">Rp{Number(price).toLocaleString("id-ID")}</p>{variants.length > 0 && <div className={`grid ${gridClass} gap-2`}>{variants.map((item, index) => <button type="button" key={item.sku || index} onClick={() => setSelectedVariant(index)} className={`rounded-md border px-2 py-2 text-left text-[10px] ${index === selectedVariant ? "border-[var(--ink)]" : "border-[var(--line)]"}`}><span className="block font-medium">{item.name || item.sku || `Varian ${index + 1}`}</span><span className="font-mono text-[var(--muted)]">Rp{Number(item.price || 0).toLocaleString("id-ID")}</span></button>)}</div>}{visibleFields.length > 0 && <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-3">{visibleFields.map((field) => <PreviewField field={field} key={field.id || field.name || field.label} />)}</div>}{settings.isStoreOpen !== false && <button type="button" className="w-full rounded-md px-3 py-2 text-xs font-semibold text-[var(--paper)]" style={{ background: accent }}>Tambah ke pesanan</button>}</div>
      </div>
    </div>
  </div>;
}

function PreviewField({ field }) {
  const base = "w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 text-xs";
  const label = field.label || field.name || "Field";
  return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-[var(--ink)]">{label}{(field.is_required || field.required) && <span className="text-[var(--brick)]"> *</span>}</label>{field.type === "textarea" || field.type === "long_text" ? <textarea disabled rows={2} className={base} placeholder="Isian panjang" /> : field.type === "dropdown" ? <select disabled className={base}><option>Pilih salah satu</option>{(field.options || []).map((option, index) => <option key={index}>{typeof option === "string" ? option : option.label}</option>)}</select> : <input disabled type={field.type === "number" ? "number" : "text"} className={base} placeholder="Isian singkat" />}</div>;
}
