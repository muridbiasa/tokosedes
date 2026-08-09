"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
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

export default function NewProductPage() {
  const router = useRouter();
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [fields, setFields] = useState([]);
  const [mobileTab, setMobileTab] = useState("edit");
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async (finalProduct, finalFields) => {
    setIsSaving(true);
    
    try {
      // Memanggil API Backend alih-alih client-side Firestore
      const res = await fetch('/api/admin/product/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'tokosedes-prod',
          product: finalProduct,
          fields: finalFields
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan produk');

      setIsSaving(false);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        router.push("/admin/dashboard");
      }, 1500);

    } catch (error) {
      console.error("Gagal menyimpan produk:", error);
      alert("Terjadi kesalahan: " + error.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] relative">
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

      {/* Pop-up Loading & Sukses */}
      {(isSaving || showSuccess) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-8 shadow-xl">
            {isSaving ? (
              <>
                <Loader2 size={40} className="animate-spin text-[var(--ink)]" />
                <p className="text-sm font-medium text-[var(--ink)]">Menyimpan produk ke database...</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={40} className="text-[var(--pine)]" />
                <p className="text-sm font-medium text-[var(--ink)]">Produk berhasil disimpan!</p>
                <p className="text-xs text-[var(--muted)]">Mengalihkan ke dashboard...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}