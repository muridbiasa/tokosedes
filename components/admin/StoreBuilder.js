"use client";

import { useEffect, useState } from "react";
import { updateProfileSettings } from "@/lib/storeProfiles";

const FONT_OPTIONS = [
  ["sans-serif", "Sans-serif"],
  ["Montserrat", "Montserrat"],
  ["Poppins", "Poppins"],
  ["Space Grotesk", "Space Grotesk"],
  ["Inter", "Inter"],
  ["Plus Jakarta Sans", "Plus Jakarta Sans"],
  ["Caveat", "Caveat / Handwriting"],
];
const LAYOUTS = [
  ["small", "Small grid", "3–4 items / row"],
  ["medium", "Medium grid", "2 items / row"],
  ["large", "Large grid", "1 item / row"],
  ["carousel", "Swipe carousel", "Horizontal scroll"],
];

export default function StoreBuilder({ storeId, settings, onChange }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);

  useEffect(() => {
    if (!settings || !storeId) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await updateProfileSettings(storeId, settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
      } catch (error) {
        console.error("[v0] Store settings autosave failed", error);
      } finally { setSaving(false); }
    }, 650);
    return () => clearTimeout(timer);
  }, [settings, storeId]);

  if (!settings) return null;
  const patch = (value) => onChange({ ...settings, ...value });
  const headerMode = settings.headerMode || "solid";

  return <section className="flex flex-col gap-5 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-5">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Store builder</p><h2 className="font-display text-xl font-semibold">Tampilan & checkout</h2><p className="mt-1 text-sm text-[var(--muted)]">Perubahan disimpan otomatis ke profil aktif.</p></div>
      <span aria-live="polite" className="font-mono text-xs text-[var(--muted)]">{saving ? "Menyimpan…" : saved ? "Tersimpan" : "Auto-save"}</span>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-sm font-medium sm:col-span-2">Nama toko<input value={settings.storeName || ""} onChange={(e) => patch({ storeName: e.target.value })} placeholder="Contoh: Toko Sedes" className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm"/></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Font storefront<select value={settings.fontFamily || "sans-serif"} onChange={(e) => patch({ fontFamily: e.target.value })} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 font-sans text-sm">{FONT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Warna utama<div className="flex gap-2"><input aria-label="Color wheel" type="color" value={settings.themeColor || "#F2A93B"} onChange={(e) => patch({ themeColor: e.target.value })} className="h-10 w-12 rounded-md border border-[var(--line)] bg-transparent p-1"/><input aria-label="Hex color" value={settings.themeColor || "#F2A93B"} onChange={(e) => patch({ themeColor: e.target.value })} pattern="^#[0-9A-Fa-f]{6}$" className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm uppercase"/></div></label>
    </div>
    <fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Header storefront</legend><div className="grid gap-2 sm:grid-cols-3">{[["solid", "Solid color"], ["gradient", "Custom gradient"], ["image", "Image banner"]].map(([value, label]) => <label key={value} className={`cursor-pointer rounded-md border p-3 text-sm ${headerMode === value ? "border-[var(--ink)] bg-[var(--canvas)]" : "border-[var(--line)]"}`}><input type="radio" name="headerMode" value={value} checked={headerMode === value} onChange={() => patch({ headerMode: value })} className="sr-only"/><span className="font-medium">{label}</span></label>)}</div>{headerMode === "gradient" && <input aria-label="Header gradient" value={settings.headerValue || ""} onChange={(e) => patch({ headerValue: e.target.value })} placeholder="linear-gradient(120deg, #14213D, #F2A93B)" className="rounded-md border border-[var(--line)] px-3 py-2 font-mono text-sm"/>}{headerMode === "image" && <div className="flex flex-col gap-2"><input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} className="rounded-md border border-[var(--line)] p-2 text-sm"/><p className="text-xs text-[var(--muted)]">Rekomendasi 1600 × 500 px. {bannerFile ? bannerFile.name : "Simpan URL banner pada field headerValue."}</p><input aria-label="Header image URL" value={settings.headerValue || ""} onChange={(e) => patch({ headerValue: e.target.value })} placeholder="https://..." className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"/></div>}</fieldset>
    <fieldset className="flex flex-col gap-3"><legend className="text-sm font-medium">Layout katalog</legend><div className="grid gap-2 sm:grid-cols-4">{LAYOUTS.map(([value, label, hint]) => <label key={value} className={`cursor-pointer rounded-md border p-3 ${settings.catalogGridSize === value ? "border-[var(--ink)] bg-[var(--canvas)]" : "border-[var(--line)]"}`}><input type="radio" name="catalogGridSize" value={value} checked={(settings.catalogGridSize || "medium") === value} onChange={() => patch({ catalogGridSize: value })} className="sr-only"/><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span></label>)}</div></fieldset>
    <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4"><label className="flex items-center justify-between gap-3 text-sm font-medium">Status toko <input type="checkbox" checked={settings.isStoreOpen !== false} onChange={(e) => patch({ isStoreOpen: e.target.checked })} className="size-5 accent-[var(--marigold)]"/></label>{settings.isStoreOpen === false && <textarea value={settings.closedMessage || ""} onChange={(e) => patch({ closedMessage: e.target.value })} rows={3} placeholder="Toko sedang tutup…" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"/>}</div>
  </section>;
}

export const STORE_PROFILE_PAYLOAD = {
  name: "Toko Sedes",
  enabled: true,
  settings: { storeName: "Toko Sedes", fontFamily: "Inter", themeColor: "#F2A93B", headerMode: "solid", headerValue: "", catalogGridSize: "medium", isStoreOpen: true, closedMessage: "", custom_form_fields: [] },
};
// Persisted at store_profiles/{storeId}; storefront products remain at stores/{storeId}/products.
// If a stores/{storeId} aggregate is used, copy settings into that document without changing this shape.

export { FONT_OPTIONS };
