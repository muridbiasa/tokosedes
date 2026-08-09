"use client";

import { useState } from "react";
import FormBuilder from "@/components/admin/FormBuilder";
import LivePreview from "@/components/admin/LivePreview";

const EMPTY_PRODUCT = {
  name: "",
  description: "",
  category: "",
  images: [""],
  has_variants: true,
  base_price: 0,
  base_stock: 0,
  variants: [],
};

/**
 * app/admin/produk/baru/page.js
 *
 * Contoh pemakaian: Form Builder & Live Preview berdampingan, berbagi satu
 * sumber state (`product`, `fields`) sehingga preview ter-update saat
 * Admin mengetik. Di layar kecil, ditampilkan sebagai tab "Edit" / "Pratinjau".
 */
export default function NewProductPage() {
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [fields, setFields] = useState([]);
  const [mobileTab, setMobileTab] = useState("edit");

  const handleSave = async (finalProduct, finalFields) => {
    // TODO: panggil endpoint/Cloud Function untuk menulis ke Firestore:
    //   - stores/{storeId}/products/{productId}  <- finalProduct
    //   - stores/{storeId}.custom_form_fields     <- finalFields
    // Admin (owner/staff toko) sudah punya izin tulis langsung ke `products`
    // sesuai Security Rules Modul 1, jadi ini bisa client-side write biasa
    // (berbeda dari `orders` yang wajib lewat Cloud Function).
    console.log("Simpan produk:", finalProduct, finalFields);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <div className="flex gap-2 border-b border-[var(--line)] bg-white px-4 py-2 lg:hidden">
        <button
          onClick={() => setMobileTab("edit")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            mobileTab === "edit" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setMobileTab("preview")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            mobileTab === "preview" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"
          }`}
        >
          Pratinjau
        </button>
      </div>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className={mobileTab === "edit" ? "block" : "hidden lg:block"}>
          <FormBuilder
            product={product}
            fields={fields}
            onProductChange={setProduct}
            onFieldsChange={setFields}
            onSave={handleSave}
          />
        </div>

        <div
          className={`${
            mobileTab === "preview" ? "block" : "hidden lg:block"
          } lg:sticky lg:top-8 lg:self-start`}
        >
          <LivePreview product={product} fields={fields} />
        </div>
      </div>
    </div>
  );
}
