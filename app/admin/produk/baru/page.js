"use client";

import { useEffect, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { db } from "@/lib/firebase";
import FormBuilder from "@/components/admin/FormBuilder";
import StoreBuilder from "@/components/admin/StoreBuilder";
import LivePreview from "@/components/admin/LivePreview";
import CloudinaryImageUpload from "@/components/admin/CloudinaryImageUpload";
import { updateProfileSettings } from "@/lib/storeProfiles";
import { useStoreSettings } from "@/hooks/useStoreSettings";

const EMPTY_PRODUCT = {
  productId: null,
  name: "",
  description: "",
  category: "",
  images: [],
  has_variants: true,
  base_price: 0,
  selling_price: 0,
  base_cost: 0,
  base_stock: 0,
  unlimited_stock: false,
  is_active: true,
  variants: [],
};

// Samakan bentuk field lama (termasuk gaya seed: short_text/long_text/required)
// dengan skema yang dipahami FormBuilder & storefront.
function normalizeField(field, index) {
  const typeMap = { short_text: "text", long_text: "textarea" };
  return {
    field_id: field.field_id || `f_${index}_${Date.now().toString(36)}`,
    label: field.label || "",
    type: typeMap[field.type] || field.type || "text",
    options: Array.isArray(field.options) ? field.options : [],
    is_required: Boolean(field.is_required ?? field.required),
    order: Number.isFinite(field.order) ? field.order : index,
  };
}

// Petakan dokumen Firestore products/{id} ke bentuk state form editor,
// supaya data yang sudah tersimpan bisa dimuat kembali utuh saat diedit.
function productFromDoc(id, data = {}) {
  const rawImages = Array.isArray(data.images)
    ? data.images
    : data.imageUrl
      ? [data.imageUrl]
      : [];
  return {
    productId: id,
    name: data.name || "",
    description: data.description || "",
    category: data.category || "",
    images: rawImages.filter(Boolean),
    has_variants: Boolean(data.has_variants),
    base_price: Number(data.base_price ?? data.price ?? 0) || 0,
    selling_price: Number(data.selling_price ?? data.base_price ?? data.price ?? 0) || 0,
    base_cost: Number(data.base_cost ?? data.hpp ?? 0) || 0,
    base_stock: Number(data.base_stock ?? data.stock ?? 0) || 0,
    unlimited_stock: Boolean(data.unlimited_stock),
    is_active: data.is_active !== false,
    variants: (Array.isArray(data.variants) ? data.variants : []).map((v, i) => ({
      sku: v.sku || `VAR-${i + 1}`,
      name: v.name || `Varian ${i + 1}`,
      price: Number(v.price || 0) || 0,
      stock: Number(v.stock || 0) || 0,
      unlimited_stock: Boolean(v.unlimited_stock),
      image_url: v.image_url || "",
    })),
  };
}

export default function NewProductPage() {
  const { storeId, settings } = useStoreSettings();
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [fields, setFields] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [mobileTab, setMobileTab] = useState("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Adopsi settings dari hook hanya SEKALI (snapshot pertama) agar autosave
  // StoreBuilder / ketikan admin tidak tertimpa emisi onSnapshot berikutnya.
  const settingsAdoptedRef = useRef(false);
  useEffect(() => {
    if (!settingsAdoptedRef.current && settings) {
      setStoreSettings(settings);
      settingsAdoptedRef.current = true;
    }
  }, [settings]);

  // Hidrasi custom_form_fields tersimpan ke state form (sekali saja,
  // sebelum admin mengubah apa pun) sehingga sesi berikutnya tidak kosong.
  const fieldsHydratedRef = useRef(false);
  useEffect(() => {
    if (!fieldsHydratedRef.current && settings) {
      const saved = settings.custom_form_fields;
      if (Array.isArray(saved)) setFields(saved.map(normalizeField));
      fieldsHydratedRef.current = true;
    }
  }, [settings]);

  // Muat daftar produk toko ini untuk pemilih "edit produk existing".
  useEffect(() => {
    let active = true;
    async function fetchProducts() {
      if (!storeId) return;
      try {
        const snap = await getDocs(collection(db, "stores", storeId, "products"));
        if (!active) return;
        setProducts(snap.docs.map((doc) => productFromDoc(doc.id, doc.data())));
      } catch (err) {
        console.error("[produk/baru] Gagal memuat daftar produk:", err);
      } finally {
        if (active) setLoadingProducts(false);
      }
    }
    setLoadingProducts(true);
    fetchProducts();
    return () => { active = false; };
  }, [storeId]);

  function loadProduct(id) {
    if (id === "__new__") {
      setProduct({ ...EMPTY_PRODUCT });
      return;
    }
    const found = products.find((p) => p.productId === id);
    if (found) setProduct(found);
  }

  function patchProduct(patch) {
    setProduct((current) => ({ ...current, ...patch }));
  }

  async function persistSettingsAndFields() {
    await updateProfileSettings(storeId, {
      ...(storeSettings || {}),
      custom_form_fields: fields,
    });
  }

  async function handleSave(finalProduct, finalFields) {
    setIsSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/product/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          productId: finalProduct.productId || undefined,
          product: finalProduct,
          fields: finalFields,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      // Kunci form pada dokumen yang sama: simpan berikutnya memperbarui,
      // bukan membuat produk duplikat baru.
      patchProduct({ productId: data.productId });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
    } catch (error) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="min-h-screen bg-[var(--canvas)]"><div className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Editor / {storeId}</p><h1 className="font-display text-xl font-semibold">Bangun katalog toko</h1></div><button onClick={() => persistSettingsAndFields().catch((e) => setSaveError(e.message))} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold"><Save size={14}/> Simpan pengaturan &amp; form</button></div></div>{saveError && <div role="alert" className="mx-auto mt-4 max-w-6xl rounded-md border border-[var(--brick)] bg-[var(--brick)]/10 px-4 py-3 text-sm text-[var(--brick)]">{saveError}</div>}<div className="flex gap-2 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-2 lg:hidden"><button onClick={() => setMobileTab("edit")} className={`rounded-md px-3 py-1.5 text-sm ${mobileTab === "edit" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)]"}`}>Edit</button><button onClick={() => setMobileTab("preview")} className={`rounded-md px-3 py-1.5 text-sm ${mobileTab === "preview" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)]"}`}>Pratinjau</button></div><div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]"><div className={mobileTab === "edit" ? "block" : "hidden lg:block"}>

<section className="mb-8 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Produk</h2><p className="text-xs text-[var(--muted)]">Pilih produk tersimpan untuk diedit, atau mulai produk baru.</p></div><span className="rounded-full bg-[var(--canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">{product.productId ? `Mode edit · ${product.productId}` : "Produk baru"}</span></div><select aria-label="Pilih produk" disabled={loadingProducts} value={product.productId || "__new__"} onChange={(e) => loadProduct(e.target.value)} className="mt-3 w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm">{loadingProducts ? <option>Memuat produk…</option> : <><option value="__new__">+ Produk baru</option>{products.map((p) => <option key={p.productId} value={p.productId}>{p.name || "(tanpa nama)"}</option>)}</>}</select></section>

<StoreBuilder storeId={storeId} settings={storeSettings} onChange={(next) => { setStoreSettings(next); }} /><section className="mb-8 mt-8 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div><h2 className="font-display text-lg font-semibold">Gambar produk</h2><p className="text-xs text-[var(--muted)]">Upload otomatis dikonversi ke WebP maksimal 1600px melalui Cloudinary.</p></div><CloudinaryImageUpload value={product.images} onChange={(images) => patchProduct({ images })} /></section><FormBuilder product={product} fields={fields} onProductChange={setProduct} onFieldsChange={setFields} onSave={handleSave}/></div><div className={`${mobileTab === "preview" ? "block" : "hidden lg:block"} lg:sticky lg:top-8 lg:self-start`}><LivePreview product={product} fields={fields} settings={storeSettings || {}}/></div></div>{(isSaving || showSuccess) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/30 p-4"><div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--paper)] p-8 shadow-xl">{isSaving ? <Loader2 className="animate-spin"/> : <CheckCircle2 className="text-[var(--pine)]"/>}<p className="text-sm font-medium">{isSaving ? "Menyimpan..." : "Produk berhasil disimpan"}</p></div></div>}</div>;
}
