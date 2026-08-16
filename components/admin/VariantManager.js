"use client";

import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import DriveImage from "../shared/DriveImage";

const QUICK_SIZES = ["S", "M", "L", "XL"];

function slugify(text) {
  return (text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * components/admin/VariantManager.js
 *
 * Manajemen varian produk (Firestore: products/{id}.variants[] — lihat
 * Modul 1 §1.2.1). Tiap baris didesain seperti "label harga" fisik toko:
 * garis putus-putus + lubang perforasi, SKU pakai font mono.
 *
 * Props:
 *  - productName: string  (dipakai untuk auto-generate SKU)
 *  - variants: [{ sku, name, price, stock, image_url }]
 *  - onChange(nextVariants)
 */
export default function VariantManager({ productName, variants, onChange }) {
  const [bulkPrice, setBulkPrice] = useState("");

  const update = (index, patch) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  };

  const addVariant = (presetName = "") => {
    const base = slugify(productName).slice(0, 6) || "PRD";
    const name = presetName || `Varian ${variants.length + 1}`;
    const sku = `${base}-${slugify(name)}`;
    onChange([...variants, { sku, name, price: 0, stock: 0, image_url: "" }]);
  };

  const removeVariant = (index) => onChange(variants.filter((_, i) => i !== index));

  const applyBulkPrice = () => {
    const price = Number(bulkPrice);
    if (!price) return;
    onChange(variants.map((v) => ({ ...v, price })));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)] mr-1">Tambah cepat:</span>
        {QUICK_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => addVariant(size)}
            className="rounded-full border border-[var(--ink)] px-3 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors"
          >
            {size}
          </button>
        ))}
        <button
          type="button"
          onClick={() => addVariant()}
          className="flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--marigold)] hover:text-[var(--ink)]"
        >
          <Plus size={12} /> Varian custom
        </button>
      </div>

      {variants.length > 1 && (
        <div className="flex items-center gap-2 rounded-md bg-[var(--canvas)] px-3 py-2">
          <span className="text-xs text-[var(--muted)]">Samakan harga semua varian:</span>
          <input
            type="number"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            placeholder="50000"
            className="w-28 rounded border border-[var(--line)] px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={applyBulkPrice}
            className="flex items-center gap-1 text-xs font-medium text-[var(--pine)] hover:underline"
          >
            <Copy size={12} /> Terapkan
          </button>
        </div>
      )}

      <div className="space-y-2">
        {variants.map((v, i) => (
          <div
            key={i}
            className="relative flex flex-wrap items-center gap-3 rounded-md border border-dashed border-[var(--line)] bg-[var(--paper)] pl-4 pr-3 py-3"
          >
            {/* lubang perforasi ala label harga toko */}
            <span className="absolute -left-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-[var(--canvas)] border border-[var(--line)]" />

            <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-[var(--line)]">
              {v.image_url ? (
                <DriveImage src={v.image_url} alt={v.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[var(--canvas)]" />
              )}
            </div>

            <input
              type="text"
              value={v.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="Nama varian"
              className="w-24 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-medium"
            />

            <input
              type="text"
              value={v.sku}
              onChange={(e) => update(i, { sku: e.target.value })}
              placeholder="SKU"
              className="w-28 rounded border border-[var(--line)] px-2 py-1.5 text-xs font-mono text-[var(--muted)]"
            />

            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--muted)]">Rp</span>
              <input
                type="number"
                value={v.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
                className="w-24 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--muted)]">Stok</span>
              <input
                type="number"
                value={v.stock}
                onChange={(e) => update(i, { stock: Number(e.target.value) })}
                className="w-16 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono"
              />
            </div>

            <input
              type="text"
              value={v.image_url}
              onChange={(e) => update(i, { image_url: e.target.value })}
              placeholder="Link gambar Drive (opsional)"
              className="hidden lg:block flex-1 min-w-[140px] rounded border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--muted)]"
            />

            <button
              type="button"
              onClick={() => removeVariant(i)}
              className="text-[var(--muted)] hover:text-[var(--brick)]"
              aria-label="Hapus varian"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {variants.length === 0 && (
        <p className="text-xs text-[var(--muted)] italic">
          Belum ada varian. Klik S / M / L di atas, atau tambah varian custom.
        </p>
      )}
    </div>
  );
}
