"use client";

import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import DriveImage from "../shared/DriveImage";
import { CloudinarySingleImageUpload } from "@/components/admin/CloudinaryImageUpload";

function slugify(text) { return (text || "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
const QUICK_SIZES = ["S", "M", "L", "XL"];

export default function VariantManager({ productName, variants = [], onChange, storeId }) {
  const [bulkPrice, setBulkPrice] = useState("");
  const update = (index, patch) => onChange(variants.map((v, i) => i === index ? { ...v, ...patch } : v));
  const addVariant = (presetName = "") => {
    const name = presetName || `Varian ${variants.length + 1}`;
    onChange([...variants, { sku: `${slugify(productName).slice(0, 6) || "PRD"}-${slugify(name)}`, name, price: 0, stock: 0, unlimited_stock: false, image_url: "" }]);
  };
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-[var(--muted)]">Tambah cepat:</span>{QUICK_SIZES.map((size) => <button key={size} type="button" onClick={() => addVariant(size)} className="rounded-full border border-[var(--ink)] px-3 py-1 text-xs font-semibold hover:bg-[var(--ink)] hover:text-[var(--paper)]">{size}</button>)}<button type="button" onClick={() => addVariant()} className="flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-xs"><Plus data-icon="inline-start" /> Varian custom</button></div>
    {variants.length > 1 && <div className="flex items-center gap-2 rounded-md bg-[var(--canvas)] px-3 py-2"><span className="text-xs text-[var(--muted)]">Samakan harga:</span><input type="number" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} className="w-28 rounded border border-[var(--line)] px-2 py-1 text-xs font-mono"/><button type="button" onClick={() => { const price = Number(bulkPrice); if (price >= 0) onChange(variants.map((v) => ({ ...v, price }))); }} className="text-xs font-medium"> <Copy data-icon="inline-start" /> Terapkan</button></div>}
    <div className="flex flex-col gap-2">{variants.map((v, i) => <div key={v.sku || i} className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-[var(--line)] bg-[var(--paper)] p-3">
      <div className="size-12 shrink-0 overflow-hidden rounded border border-[var(--line)]">{v.image_url ? <DriveImage src={v.image_url} alt={v.name} className="size-full object-cover" /> : <div className="size-full bg-[var(--canvas)]" />}</div>
      <CloudinarySingleImageUpload value={v.image_url} onChange={(image_url) => update(i, { image_url })} />
      <input aria-label="Nama varian" value={v.name} onChange={(e) => update(i, { name: e.target.value })} className="w-24 rounded border border-[var(--line)] px-2 py-1.5 text-sm" />
      <input aria-label="SKU varian" value={v.sku} onChange={(e) => update(i, { sku: e.target.value })} className="w-28 rounded border border-[var(--line)] px-2 py-1.5 text-xs font-mono" />
      <input aria-label="Harga varian" type="number" min="0" value={v.price} onChange={(e) => update(i, { price: Number(e.target.value) })} className="w-24 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono" />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(v.unlimited_stock)} onChange={(e) => update(i, { unlimited_stock: e.target.checked, stock: e.target.checked ? 0 : v.stock })} /> Tanpa batas</label>
      {!v.unlimited_stock && <input aria-label="Stok varian" type="number" min="0" value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} className="w-16 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono" />}
      <button type="button" onClick={() => onChange(variants.filter((_, n) => n !== i))} className="ml-auto text-[var(--muted)] hover:text-[var(--brick)]" aria-label="Hapus varian"><Trash2 data-icon="inline-start" /></button>
    </div>)}</div>
    {!variants.length && <p className="text-xs italic text-[var(--muted)]">Belum ada varian.</p>}
  </div>;
}
