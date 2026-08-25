"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DriveImage from "../shared/DriveImage";

const FALLBACK_STACK = "'Inter', sans-serif";

function fontStack(family) {
  if (!family || family === "sans-serif") return FALLBACK_STACK;
  return `'${family}', 'Inter', sans-serif`;
}

/**
 * LivePreview — pratinjau etalase yang FULLY REACTIVE terhadap panel input.
 * Semua nilai desain (themeColor, fontFamily, headerMode/headerValue,
 * isStoreOpen/closedMessage) dibaca dari props `settings` pada setiap render,
 * jadi perubahan di StoreBuilder langsung tampak tanpa fallback tersangkut.
 */
export default function LivePreview({ product, fields, settings = {} }) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => { if (selectedVariant >= (product.variants?.length || 0)) setSelectedVariant(0); setImageIndex(0); }, [product.variants, selectedVariant]);
  const variant = product.has_variants ? product.variants?.[selectedVariant] : null;
  const price = variant?.price ?? product.selling_price ?? product.base_price;
  const images = [...new Set([variant?.image_url, ...(product.images || [])].filter(Boolean))];

  // --- Nilai desain dari settings (fallback konsisten dengan storefront) ---
  const themeColor = settings.themeColor || "var(--marigold)";
  const fontFamily = fontStack(settings.fontFamily);
  const isOpen = settings.isStoreOpen !== false;
  const headerMode = settings.headerMode || "solid";
  const storeName = settings.storeName || product.name || "Toko Sedes";

  let headerStyle;
  if (headerMode === "gradient" && settings.headerValue) {
    headerStyle = { backgroundImage: settings.headerValue };
  } else if (headerMode === "solid") {
    headerStyle = { backgroundColor: themeColor };
  } else {
    headerStyle = { backgroundColor: themeColor }; // mode image: warna jadi lapisan bawah banner
  }

  return <div className="mx-auto w-[300px]" style={{ fontFamily }}><div className="rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--ink)] shadow-xl"><div className="flex h-5 items-center justify-center"><div className="h-1 w-10 rounded-full bg-[var(--paper)]/30" /></div><div className="h-[560px] overflow-y-auto rounded-b-[1.6rem] bg-[var(--paper)]">

<div className="relative overflow-hidden border-b border-dashed border-[var(--line)]" style={headerStyle}>{headerMode === "image" && settings.headerValue ? <DriveImage src={settings.headerValue} alt="Banner toko" className="absolute inset-0 size-full object-cover opacity-80" /> : null}<div className="relative z-10 flex items-center justify-between gap-2 px-4 py-3" style={{ textShadow: headerMode === "image" ? "0 1px 3px rgba(0,0,0,0.55)" : undefined, color: headerMode === "image" || headerMode === "gradient" ? "#fff" : "#fff" }}><p className="truncate text-sm font-semibold">{storeName}</p><span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isOpen ? "bg-white/25" : "bg-black/35"}`}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isOpen ? "#7CFFB2" : "#FFB4A8" }} />{isOpen ? "Buka" : "Tutup"}</span></div>{!isOpen && settings.closedMessage && <p className="relative z-10 px-4 pb-3 text-[11px] leading-4 text-white/90">{settings.closedMessage}</p>}</div>

<div className="relative aspect-square w-full bg-[var(--canvas)]">{images.length ? <DriveImage src={images[imageIndex % images.length]} alt={product.name} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center text-xs text-[var(--muted)]">Belum ada gambar</div>}{images.length > 1 && <><button type="button" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 rounded-full bg-[var(--paper)]/80 p-1" aria-label="Gambar sebelumnya"><ChevronLeft data-icon="inline-start" /></button><button type="button" onClick={() => setImageIndex((imageIndex + 1) % images.length)} className="absolute right-2 top-1/2 rounded-full bg-[var(--paper)]/80 p-1" aria-label="Gambar berikutnya"><ChevronRight data-icon="inline-start" /></button></>}</div>

<div className="flex flex-col gap-4 p-4"><div><h3 className="text-base font-semibold text-[var(--ink)]">{product.name || "Nama produk"}</h3><p className="mt-1 text-xs text-[var(--muted)]">{product.description || "Deskripsi produk akan tampil di sini."}</p></div><p className="font-mono text-lg font-semibold" style={{ color: themeColor }}>Rp{Number(price || 0).toLocaleString("id-ID")}</p>{product.has_variants && product.variants?.length > 0 && <div className="flex flex-wrap gap-2"><p className="w-full text-xs font-medium text-[var(--muted)]">Pilih varian</p>{product.variants.map((v, i) => <button key={v.sku || i} type="button" onClick={() => setSelectedVariant(i)} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${i === selectedVariant ? "text-white" : "border-[var(--line)]"}`} style={i === selectedVariant ? { backgroundColor: themeColor, borderColor: themeColor } : undefined}>{v.name}</button>)}</div>}{fields?.length > 0 && <div className="flex flex-col gap-3 border-t border-dashed border-[var(--line)] pt-3">{fields.map((field) => <PreviewField key={field.field_id} field={field} />)}</div>}<button type="button" disabled className="w-full rounded-md py-2.5 text-sm font-semibold" style={{ backgroundColor: themeColor, opacity: 0.55, color: "#14213D" }}>Bayar Sekarang</button></div>

</div></div></div>;
}

function PreviewField({ field }) { const base = "w-full rounded-md border border-[var(--line)] bg-[var(--paper)] px-2.5 py-1.5 text-xs"; return <div className="flex flex-col gap-1"><label className="text-xs font-medium text-[var(--ink)]">{field.label || "(label kosong)"}{field.is_required && <span className="text-[var(--brick)]"> *</span>}</label>{field.type === "textarea" ? <textarea disabled rows={2} className={base} placeholder="Isian panjang" /> : field.type === "dropdown" ? <select disabled className={base}><option>Pilih salah satu</option>{field.options?.map((o, i) => <option key={i}>{o}</option>)}</select> : field.type === "radio" && Array.isArray(field.options) && field.options.length ? <div className="flex flex-col gap-1">{field.options.filter(Boolean).map((o, i) => <label key={i} className="flex items-center gap-1.5 text-xs text-[var(--ink)]"><input disabled type="radio" name={field.field_id} />{o}</label>)}</div> : field.type === "checkbox" && Array.isArray(field.options) && field.options.length ? <div className="flex flex-col gap-1">{field.options.filter(Boolean).map((o, i) => <label key={i} className="flex items-center gap-1.5 text-xs text-[var(--ink)]"><input disabled type="checkbox" />{o}</label>)}</div> : <input disabled type={field.type === "number" ? "number" : "text"} className={base} placeholder="Isian singkat" />}</div>; }
