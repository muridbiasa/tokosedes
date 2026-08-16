"use client";

import { useState, useEffect } from "react";
import DriveImage from "../shared/DriveImage";

/**
 * components/admin/LivePreview.js
 *
 * Preview tampilan etalase produk dari sudut pandang Pembeli, dibungkus
 * frame ponsel — memenuhi kebutuhan "Admin ingin melihat tampilan sebelum
 * dipublikasikan". Menerima `product` & `fields` yang sama persis dengan
 * yang sedang diedit di <FormBuilder />, jadi update-nya real-time.
 *
 * Props:
 *  - product: { name, description, images, has_variants, base_price, base_stock, variants }
 *  - fields: custom_form_fields[]
 */
export default function LivePreview({ product, fields }) {
  const [selectedVariant, setSelectedVariant] = useState(0);

  // reset pilihan varian kalau daftar varian berubah drastis (mis. dihapus)
  useEffect(() => {
    if (selectedVariant >= (product.variants?.length || 0)) {
      setSelectedVariant(0);
    }
  }, [product.variants, selectedVariant]);

  const variant = product.has_variants ? product.variants?.[selectedVariant] : null;
  const price = product.has_variants ? variant?.price : product.base_price;
  const stock = product.has_variants ? variant?.stock : product.base_stock;

  return (
    <div className="mx-auto w-[300px]">
      {/* Frame ponsel */}
      <div className="rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--ink)] shadow-xl">
        <div className="h-5 flex items-center justify-center">
          <div className="h-1 w-10 rounded-full bg-white/30" />
        </div>
        <div className="h-[560px] overflow-y-auto rounded-b-[1.6rem] bg-white">
          {/* header ala struk / etalase */}
          <div className="sticky top-0 z-10 border-b border-dashed border-[var(--line)] bg-white/95 px-4 py-2 backdrop-blur">
            <p className="text-[10px] tracking-widest text-[var(--muted)]">PRATINJAU ETALASE</p>
          </div>

          <div className="aspect-square w-full bg-[var(--canvas)]">
            <DriveImage
              src={product.images?.[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4 p-4">
            <div>
              <h3 className="font-display text-base font-semibold text-[var(--ink)]">
                {product.name || "Nama produk"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {product.description || "Deskripsi produk akan tampil di sini."}
              </p>
            </div>

            <p className="font-mono text-lg font-semibold text-[var(--ink)]">
              Rp{Number(price || 0).toLocaleString("id-ID")}
            </p>

            {product.has_variants && product.variants?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--muted)]">Pilih varian</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => {
                    const soldOut = v.stock <= 0;
                    return (
                      <button
                        key={v.sku || i}
                        type="button"
                        disabled={soldOut}
                        onClick={() => setSelectedVariant(i)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          i === selectedVariant
                            ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                            : "border-[var(--line)] text-[var(--ink)]"
                        } ${soldOut ? "opacity-40 line-through" : ""}`}
                      >
                        {v.name}
                      </button>
                    );
                  })}
                </div>
                {stock <= 0 && (
                  <p className="text-xs text-[var(--brick)]">Stok varian ini habis</p>
                )}
              </div>
            )}

            {fields?.length > 0 && (
              <div className="space-y-3 border-t border-dashed border-[var(--line)] pt-3">
                {fields.map((field) => (
                  <PreviewField key={field.field_id} field={field} />
                ))}
              </div>
            )}

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-md bg-[var(--marigold)]/50 py-2.5 text-sm font-semibold text-[var(--ink)]/60"
              title="Tombol nonaktif — ini hanya pratinjau"
            >
              Bayar Sekarang
            </button>
            <p className="text-center text-[10px] text-[var(--muted)]">
              Pratinjau — tombol pembayaran nonaktif
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewField({ field }) {
  const base = "w-full rounded-md border border-[var(--line)] px-2.5 py-1.5 text-xs";
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--ink)]">
        {field.label || "(label kosong)"}
        {field.is_required && <span className="text-[var(--brick)]"> *</span>}
      </label>

      {field.type === "text" && <input disabled className={base} placeholder="Isian singkat" />}
      {field.type === "number" && (
        <input disabled type="number" className={base} placeholder="0" />
      )}
      {field.type === "textarea" && (
        <textarea disabled rows={2} className={base} placeholder="Isian panjang" />
      )}

      {field.type === "dropdown" && (
        <select disabled className={base}>
          <option>Pilih salah satu</option>
          {field.options?.map((o, i) => (
            <option key={i}>{o}</option>
          ))}
        </select>
      )}

      {field.type === "radio" &&
        field.options?.map((o, i) => (
          <label key={i} className="flex items-center gap-2 text-xs text-[var(--ink)]">
            <input disabled type="radio" name={field.field_id} /> {o}
          </label>
        ))}

      {field.type === "checkbox" &&
        field.options?.map((o, i) => (
          <label key={i} className="flex items-center gap-2 text-xs text-[var(--ink)]">
            <input disabled type="checkbox" /> {o}
          </label>
        ))}
    </div>
  );
}
