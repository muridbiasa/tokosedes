"use client";

import { Plus } from "lucide-react";
import FormFieldEditor from "./FormFieldEditor";
import VariantManager from "./VariantManager";
import CloudinaryImageUpload from "./CloudinaryImageUpload";

function newFieldId() {
  return `f_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * components/admin/FormBuilder.js
 *
 * Form builder utama Admin — sesuai F-01 & F-02 PRD.
 * INI CONTROLLED COMPONENT: state produk & field disimpan di komponen
 * induk (halaman), bukan di dalam FormBuilder sendiri. Tujuannya supaya
 * perubahan bisa langsung dibagikan ke <LivePreview /> secara real-time
 * (lihat app/admin/produk/baru/page.js untuk contoh pemakaian penuh).
 *
 * Props:
 *  - product: { name, description, category, images, has_variants,
 *               base_price, base_stock, variants }
 *  - fields: custom_form_fields[] (lihat Modul 1 §1.1.1)
 *  - onProductChange(nextProduct)
 *  - onFieldsChange(nextFields)
 *  - onSave(product, fields): dipanggil saat klik "Simpan & Publikasikan"
 */
export default function FormBuilder({
  product,
  fields,
  onProductChange,
  onFieldsChange,
  onSave,
  storeId,
}) {
  const updateProduct = (patch) => onProductChange({ ...product, ...patch });

  const addField = () => {
    onFieldsChange([
      ...fields,
      {
        field_id: newFieldId(),
        label: "",
        type: "text",
        options: [],
        is_required: false,
        order: fields.length,
      },
    ]);
  };

  const updateField = (index, updated) =>
    onFieldsChange(fields.map((item, i) => (i === index ? updated : item)));

  const removeField = (index) => onFieldsChange(fields.filter((_, i) => i !== index));

  const moveField = (index, direction) => {
    const next = [...fields];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onFieldsChange(next.map((item, i) => ({ ...item, order: i })));
  };

  return (
    <div className="space-y-8">
      {/* --- Informasi Produk --- */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
          Informasi Produk
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={product.name}
            onChange={(e) => updateProduct({ name: e.target.value })}
            placeholder="Nama produk"
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
          />
          <input
            type="text"
            value={product.category}
            onChange={(e) => updateProduct({ category: e.target.value })}
            placeholder="Kategori (mis. Barang / Makanan)"
            className="rounded-md border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
          />
        </div>

        <textarea
          value={product.description}
          onChange={(e) => updateProduct({ description: e.target.value })}
          placeholder="Deskripsi produk"
          rows={3}
          className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
        />

        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--muted)]">
            Gambar produk — unggah berkas (otomatis dikonversi ke WebP maks 1600px)
          </label>
          <CloudinaryImageUpload
            value={product.images}
            onChange={(images) => updateProduct({ images })}
          />
        </div>
      </section>

      <div className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--canvas)] p-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium">HPP / modal<input type="number" min="0" value={product.base_cost || 0} onChange={(e) => updateProduct({ base_cost: Number(e.target.value) })} className="rounded border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 font-mono text-sm" /></label>
        <label className="flex flex-col gap-1 text-xs font-medium">Harga jual<input type="number" min="0" value={product.selling_price ?? product.base_price ?? 0} onChange={(e) => updateProduct({ selling_price: Number(e.target.value), base_price: Number(e.target.value) })} className="rounded border border-[var(--line)] bg-[var(--paper)] px-2 py-1.5 font-mono text-sm" /></label>
        {!product.has_variants && <label className="flex items-center gap-2 self-end text-xs"><input type="checkbox" checked={Boolean(product.unlimited_stock)} onChange={(e) => updateProduct({ unlimited_stock: e.target.checked, base_stock: e.target.checked ? 0 : product.base_stock })} /> Stok tidak terbatas</label>}
      </div>

      {/* --- Varian --- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Varian</h2>
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={product.has_variants}
              onChange={(e) => updateProduct({ has_variants: e.target.checked })}
              className="rounded border-[var(--line)] text-[var(--marigold)] focus:ring-[var(--marigold)]"
            />
            Produk ini punya varian (ukuran/warna, dst)
          </label>
        </div>

        {product.has_variants ? (
          <VariantManager
            productName={product.name}
            variants={product.variants}
            storeId={storeId}
            onChange={(variants) => updateProduct({ variants })}
          />
        ) : (
          <div className="flex gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--muted)]">Rp</span>
              <input
                type="number"
                value={product.base_price}
                onChange={(e) => updateProduct({ base_price: Number(e.target.value) })}
                className="w-28 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--muted)]">Stok</span>
              <input
                type="number"
                value={product.base_stock}
                onChange={(e) => updateProduct({ base_stock: Number(e.target.value) })}
                className="w-20 rounded border border-[var(--line)] px-2 py-1.5 text-sm font-mono"
              />
            </div>
          </div>
        )}
      </section>

      {/* --- Field Form Kustom --- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
            Data yang Diminta dari Pembeli
          </h2>
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--ink)]/90"
          >
            <Plus size={13} /> Tambah field
          </button>
        </div>

        <div className="space-y-2">
          {fields.map((field, i) => (
            <FormFieldEditor
              key={field.field_id}
              field={field}
              onChange={(updated) => updateField(i, updated)}
              onRemove={() => removeField(i)}
              onMove={(dir) => moveField(i, dir)}
            />
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-[var(--muted)] italic">
              Belum ada field tambahan. Nama & no. HP pembeli otomatis diminta saat checkout.
            </p>
          )}
        </div>
      </section>

      <div className="flex justify-end border-t border-[var(--line)] pt-4">
        <button
          type="button"
          onClick={() => onSave?.(product, fields)}
          className="rounded-md bg-[var(--marigold)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm hover:brightness-95"
        >
          Simpan &amp; Publikasikan
        </button>
      </div>
    </div>
  );
}
