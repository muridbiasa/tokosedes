"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, doc, addDoc, setDoc } from "firebase/firestore";
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

/**
 * app/admin/produk/baru/page.js
 *
 * Mode Produksi: Menyimpan Produk & Custom Fields ke Firestore.
 * Dilengkapi dengan notifikasi pop-up dan auto-redirect.
 */
export default function NewProductPage() {
  const router = useRouter();
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [fields, setFields] = useState([]);
  const [mobileTab, setMobileTab] = useState("edit");
  
  // State untuk Pop-up UI
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async (finalProduct, finalFields) => {
    setIsSaving(true);
    
    try {
      // 1. Validasi Keamanan Data (memastikan harga & stok berwujud angka murni)
      const sanitizedProduct = {
        ...finalProduct,
        base_price: Number(finalProduct.base_price) || 0,
        base_stock: Number(finalProduct.base_stock) || 0,
        created_at: new Date().toISOString()
      };

      // 2. Referensi ke dokumen toko kita (tokosedes-prod)
      const storeRef = doc(db, "stores", "tokosedes-prod");

      // 3. Simpan Produk ke sub-koleksi 'products'
      const productsRef = collection(storeRef, "products");
      await addDoc(productsRef, sanitizedProduct);

      // 4. Simpan struktur Custom Fields ke dokumen toko utama (jika ada)
      if (finalFields && finalFields.length > 0) {
        await setDoc(storeRef, { custom_form_fields: finalFields }, { merge: true });
      }

      // 5. Munculkan Pop-up Sukses
      setIsSaving(false);
      setShowSuccess(true);
      
      // 6. Alihkan kembali ke Dashboard Admin setelah 1.5 detik
      setTimeout(() => {
        setShowSuccess(false);
        router.push("/admin/dashboard");
      }, 1500);

    } catch (error) {
      console.error("Gagal menyimpan produk:", error);
      alert("Terjadi kesalahan saat menyimpan produk: " + error.message);
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

      {/* --- Pop-up Loading & Sukses (Overlay) --- */}
      {(isSaving || showSuccess) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-8 shadow-xl">
            {isSaving ? (
              <>
                <Loader2 size={40} className="animate-spin text-[var(--ink)]" />
                <p className="text-sm font-medium text-[var(--ink)]">Menyimpan produk...</p>
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