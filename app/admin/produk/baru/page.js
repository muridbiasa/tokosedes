"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import FormBuilder from "@/components/admin/FormBuilder";
import StoreBuilder from "@/components/admin/StoreBuilder";
import LivePreview from "@/components/admin/LivePreview";
import { updateProfileSettings } from "@/lib/storeProfiles";
import { useStoreSettings } from "@/hooks/useStoreSettings";

const EMPTY_PRODUCT = { name: "", description: "", category: "", images: [""], has_variants: true, base_price: 0, base_stock: 0, variants: [] };

export default function NewProductPage() {
  const router = useRouter();
  const { storeId, settings } = useStoreSettings();
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [fields, setFields] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [mobileTab, setMobileTab] = useState("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => { if (settings) setStoreSettings(settings); }, [settings]);
  const patchSettings = (patch) => setStoreSettings((current) => ({ ...(current || settings), ...patch }));

  async function handleSave(finalProduct, finalFields) {
    setIsSaving(true);
    try {
      await updateProfileSettings(storeId, { ...(storeSettings || {}), custom_form_fields: finalFields });
      const res = await fetch("/api/admin/product/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, product: finalProduct, fields: finalFields }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan produk");
      setShowSuccess(true);
      setTimeout(() => router.push("/admin/dashboard"), 1200);
    } catch (error) { alert(`Terjadi kesalahan: ${error.message}`); } finally { setIsSaving(false); }
  }

  return <div className="min-h-screen bg-[var(--canvas)]"><div className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Editor / {storeId}</p><h1 className="font-display text-xl font-semibold">Bangun katalog toko</h1></div><button onClick={() => updateProfileSettings(storeId, { ...(storeSettings || {}), custom_form_fields: fields })} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-xs font-semibold"><Save size={14}/> Simpan pengaturan</button></div></div><div className="flex gap-2 border-b border-[var(--line)] bg-[var(--paper)] px-4 py-2 lg:hidden"><button onClick={() => setMobileTab("edit")} className={`rounded-md px-3 py-1.5 text-sm ${mobileTab === "edit" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)]"}`}>Edit</button><button onClick={() => setMobileTab("preview")} className={`rounded-md px-3 py-1.5 text-sm ${mobileTab === "preview" ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--muted)]"}`}>Pratinjau</button></div><div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]"><div className={mobileTab === "edit" ? "block" : "hidden lg:block"}><StoreBuilder storeId={storeId} settings={storeSettings} onChange={setStoreSettings} /><section className="mb-8 mt-8 flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div><h2 className="font-display text-lg font-semibold">Pengaturan toko</h2><p className="text-xs text-[var(--muted)]">Perubahan diterapkan ke storefront profil aktif.</p></div><div className="grid gap-3 sm:grid-cols-2"><input value={storeSettings?.storeName || ""} onChange={(e) => patchSettings({ storeName: e.target.value })} placeholder="Nama toko" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"/><select value={storeSettings?.fontFamily || "sans-serif"} onChange={(e) => patchSettings({ fontFamily: e.target.value })} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"><option value="sans-serif">Sans-serif</option><option value="Montserrat">Montserrat</option><option value="Poppins">Poppins</option><option value="handwriting">Handwriting</option></select><input value={storeSettings?.themeColor || "#f59e0b"} onChange={(e) => patchSettings({ themeColor: e.target.value })} type="color" className="h-10 w-full rounded-md border border-[var(--line)] bg-[var(--paper)]"/><select value={storeSettings?.catalogGridSize || "medium"} onChange={(e) => patchSettings({ catalogGridSize: e.target.value })} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"><option value="small">Grid kecil</option><option value="medium">Grid sedang</option><option value="large">Grid besar</option><option value="carousel">Horizontal carousel</option></select></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={storeSettings?.isStoreOpen ?? true} onChange={(e) => patchSettings({ isStoreOpen: e.target.checked })}/> Toko sedang buka</label>{storeSettings?.isStoreOpen === false && <input value={storeSettings?.closedMessage || ""} onChange={(e) => patchSettings({ closedMessage: e.target.value })} placeholder="Pesan saat toko tutup" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"/>}</section><FormBuilder product={product} fields={fields} onProductChange={setProduct} onFieldsChange={setFields} onSave={handleSave}/></div><div className={`${mobileTab === "preview" ? "block" : "hidden lg:block"} lg:sticky lg:top-8 lg:self-start`}><LivePreview product={product} fields={fields}/></div></div>{(isSaving || showSuccess) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/30 p-4"><div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--paper)] p-8 shadow-xl">{isSaving ? <Loader2 className="animate-spin"/> : <CheckCircle2 className="text-[var(--pine)]"/>}<p className="text-sm font-medium">{isSaving ? "Menyimpan..." : "Produk berhasil disimpan"}</p></div></div>}</div>;
}
