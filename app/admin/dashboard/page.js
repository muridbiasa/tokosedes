"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createProfile, setActiveProfile, subscribeActiveProfile, subscribeProfiles, toCsv, updateProfile } from "@/lib/storeProfiles";
import { Download, ExternalLink, Loader2, Plus, Search, Store, TrendingUp, Wallet, X } from "lucide-react";
import AdminAuthGate from "@/components/admin/AdminAuthGate";

const STATUS_TABS = ["Semua", "PAID", "PENDING", "EXPIRED", "FAILED"];
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const asDate = (value) => value?.toDate ? value.toDate() : new Date(value || 0);
const dateText = (value) => value ? asDate(value).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

function AdminDashboardContent() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Semua");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeProfiles(setProfiles, (e) => { setError(e?.code === "permission-denied" ? "Firebase menolak akses. Pastikan Firestore Rules dan claim admin sudah aktif." : "Profil toko gagal dimuat."); setLoading(false); }), []);
  useEffect(() => subscribeActiveProfile(setActiveId, (e) => setError(e?.code === "permission-denied" ? "Tidak dapat membaca toko aktif. Periksa Firestore Rules." : "Toko aktif gagal dimuat.")), []);
  useEffect(() => {
    if (!activeId) { setOrders([]); setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(query(collection(db, "orders"), where("store_id", "==", activeId)), (snap) => {
      setOrders(snap.docs.map((item) => ({ order_id: item.id, ...item.data() })).sort((a, b) => asDate(b.created_at) - asDate(a.created_at)));
      setLoading(false);
    }, (e) => { setError(e?.code === "permission-denied" ? "Pesanan ditolak oleh Firestore Rules." : "Pesanan gagal dimuat."); setLoading(false); });
  }, [activeId]);

  const filtered = useMemo(() => {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const date = asDate(order.created_at);
      if (range === "today" && date < today) return false;
      if (range === "yesterday" && (date < new Date(today - 86400000) || date >= today)) return false;
      if (status !== "Semua" && order.payment_status !== status) return false;
      return !term || `${order.order_id} ${order.customer_name || ""} ${order.customer_phone || ""}`.toLowerCase().includes(term);
    });
  }, [orders, range, search, status]);
  const metrics = useMemo(() => {
    const paid = filtered.filter((o) => o.payment_status === "PAID"); let hpp = 0; const products = {};
    paid.forEach((o) => (o.items || []).forEach((item) => { const qty = Number(item.quantity || item.qty || 1); hpp += Number(item.hpp ?? item.base_cost ?? 0) * qty; products[item.name] = (products[item.name] || 0) + qty; }));
    return { revenue: paid.reduce((sum, o) => sum + Number(o.total_amount || 0), 0), hpp, buyers: new Set(paid.map((o) => o.customer_phone || o.customer_name)).size, paid: paid.length, failed: filtered.filter((o) => ["FAILED", "EXPIRED"].includes(o.payment_status)).length, products: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [filtered]);

  async function handleCreate(event) {
    event.preventDefault(); const trimmed = name.trim(); if (trimmed.length < 2 || saving) return;
    setSaving(true); setError("");
    try { const id = await createProfile(trimmed); await setActiveProfile(id); setName(""); setShowCreate(false); }
    catch (e) { setError(e?.code === "permission-denied" ? "Akses ditolak. Logout lalu login ulang setelah claim admin aktif." : e?.message || "Toko gagal dibuat."); }
    finally { setSaving(false); }
  }
  async function useProfile(profile) {
    if (saving || profile.id === activeId) return;
    setSaving(true); setError("");
    try { if (!profile.enabled) await updateProfile(profile.id, { enabled: true }); await setActiveProfile(profile.id); }
    catch (e) { setError(e?.code === "permission-denied" ? "Akses ditolak Firebase saat mengganti toko." : "Toko aktif gagal diubah."); }
    finally { setSaving(false); }
  }
  async function toggleProfile(profile) {
    if (saving) return;
    if (profile.id === activeId && profile.enabled && profiles.filter((p) => p.enabled).length === 1) { setError("Aktifkan toko lain sebelum menonaktifkan toko ini."); return; }
    setSaving(true); setError("");
    try { await updateProfile(profile.id, { enabled: !profile.enabled }); if (!profile.enabled) await setActiveProfile(profile.id); }
    catch (e) { setError(e?.code === "permission-denied" ? "Akses ditolak Firebase saat mengubah status toko." : "Status toko gagal disimpan."); }
    finally { setSaving(false); }
  }
  function downloadCsv() { const rows = filtered.map((o) => ({ id: o.order_id, waktu: dateText(o.created_at), pembeli: o.customer_name, whatsapp: o.customer_phone, total: o.total_amount, status: o.payment_status })); const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `orders-${activeId || "store"}.csv`; a.click(); URL.revokeObjectURL(url); }

  const activeName = profiles.find((p) => p.id === activeId)?.name;
  return <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-5"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">TokoSedes / Admin</p><h1 className="mt-1 font-display text-2xl font-semibold">Store control center</h1></div><div className="flex gap-2"><Link href="/" target="_blank" className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm"><ExternalLink size={15} /> Lihat toko</Link><button type="button" onClick={() => { setError(""); setShowCreate(true); }} className="flex items-center gap-2 rounded-md bg-[var(--marigold)] px-3 py-2 text-sm font-semibold"><Plus size={16} /> Toko baru</button></div></div></header>
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">{error && <div role="alert" className="rounded-md border border-[var(--brick)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--brick)]">{error}</div>}
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.05em] text-[var(--muted)]">Profil toko</p><h2 className="font-display text-xl font-semibold">Pilih workspace aktif</h2></div><span className="text-xs text-[var(--muted)]">{profiles.length} profil</span></div>
        {profiles.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--outline-variant)] bg-[var(--paper)] p-8 text-center"><Store size={24} /><h3 className="mt-4 font-display text-lg font-semibold">Belum ada toko</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Buat toko pertama untuk mulai mengatur katalog, checkout, dan laporan pesanan.</p><button type="button" onClick={() => setShowCreate(true)} className="mt-5 rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)]"><Plus size={16} className="mr-2 inline" />Buat toko pertama</button></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((profile) => <article key={profile.id} className={`rounded-lg border bg-[var(--paper)] p-4 ${profile.id === activeId ? "border-[var(--ink)] shadow-sm" : "border-[var(--line)]"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-[var(--canvas)]"><Store size={18} /></div><div><button type="button" onClick={() => useProfile(profile)} className="text-left font-semibold underline-offset-4 hover:underline">{profile.name}</button><p className="text-xs text-[var(--muted)]">{profile.id}</p></div></div><button type="button" aria-label={`Ubah status ${profile.name}`} disabled={saving} onClick={() => toggleProfile(profile)} className={`h-6 w-10 rounded-full p-1 ${profile.enabled ? "bg-[var(--green)]" : "bg-[var(--muted)]"}`}><span className={`block size-4 rounded-full bg-[var(--paper)] transition-transform ${profile.enabled ? "translate-x-4" : ""}`} /></button></div><p className="mt-4 text-xs text-[var(--muted)]">{profile.enabled ? "ON · aktif" : "OFF · nonaktif"}</p><div className="mt-3 flex gap-3 text-xs"><button type="button" disabled={saving || profile.id === activeId} onClick={() => useProfile(profile)} className="font-semibold underline disabled:cursor-default disabled:no-underline disabled:opacity-50">{profile.id === activeId ? "Digunakan" : "Gunakan"}</button><Link href={`/admin/produk/baru?storeId=${encodeURIComponent(profile.id)}`} className="text-[var(--muted)] underline">Kelola toko</Link><Link href={`/admin/orders?storeId=${encodeURIComponent(profile.id)}`} className="ml-auto text-[var(--muted)] underline">Laporan</Link></div></article>)}</div>}
      </section>
      <section className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.05em] text-[var(--muted)]">Analytics</p><h2 className="font-display text-xl font-semibold">{activeName || "Belum ada toko aktif"}</h2></div><div className="flex gap-2"><select aria-label="Rentang waktu" value={range} onChange={(e) => setRange(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs"><option value="all">Semua waktu</option><option value="today">Hari ini</option><option value="yesterday">Kemarin</option></select><button type="button" disabled={!filtered.length} onClick={downloadCsv} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold disabled:opacity-40"><Download size={14} /> CSV</button></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Wallet size={17} />} label="Revenue" value={money(metrics.revenue)} /><Metric icon={<TrendingUp size={17} />} label="Net profit" value={money(metrics.revenue - metrics.hpp)} /><Metric label="Pembeli" value={metrics.buyers} /><Metric label="PAID / gagal" value={`${metrics.paid} / ${metrics.failed}`} /></div>{profiles.length > 0 && <><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input aria-label="Cari pesanan" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pembeli, WhatsApp, ID pesanan" className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] py-2 pl-9 pr-3 text-sm" /></div><div className="flex flex-wrap gap-2">{STATUS_TABS.map((item) => <button type="button" key={item} onClick={() => setStatus(item)} className={`rounded-full border px-3 py-2 text-xs ${status === item ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] bg-[var(--paper)]"}`}>{item}</button>)}</div><div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--paper)]"><table className="w-full min-w-[640px] text-left text-xs"><thead><tr className="border-b border-[var(--line)] text-[var(--muted)]"><th className="p-3">ID PESANAN</th><th className="p-3">WAKTU</th><th className="p-3">PEMBELI</th><th className="p-3">TOTAL</th><th className="p-3">STATUS</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="p-6 text-center text-[var(--muted)]"><Loader2 className="mr-2 inline animate-spin" size={15} />Memuat pesanan...</td></tr> : filtered.length ? filtered.map((o) => <tr key={o.order_id} className="border-b border-[var(--line)] last:border-0"><td className="p-3 font-mono">{o.order_id}</td><td className="p-3 text-[var(--muted)]">{dateText(o.created_at)}</td><td className="p-3">{o.customer_name || "-"}</td><td className="p-3 font-mono">{money(o.total_amount)}</td><td className="p-3 font-semibold">{o.payment_status || "PENDING"}</td></tr>) : <tr><td colSpan="5" className="p-8 text-center text-[var(--muted)]">Belum ada pesanan untuk toko ini.</td></tr>}</tbody></table></div></>}</section>
    </main>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 p-4"><form onSubmit={handleCreate} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="flex items-center justify-between"><h2 id="create-title" className="font-display text-lg font-semibold">Buat profil toko</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Tutup"><X size={18} /></button></div><label htmlFor="store-name" className="text-sm font-semibold">Nama toko</label><input id="store-name" autoFocus required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Toko Sedes" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />{error && <p role="alert" className="text-sm text-[var(--brick)]">{error}</p>}<button disabled={saving} className="rounded-md bg-[var(--marigold)] px-4 py-2 text-sm font-semibold disabled:opacity-60">{saving ? "Menyimpan..." : "Buat & aktifkan"}</button></form></div>}
  </div>;
}
export default function AdminDashboardPage() { return <AdminAuthGate><AdminDashboardContent /></AdminAuthGate>; }
function Metric({ icon, label, value }) { return <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div><p className="mt-2 font-mono text-xl font-semibold">{value}</p></div>; }

// end
