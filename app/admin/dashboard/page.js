"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createProfile, setActiveProfile, subscribeActiveProfile, subscribeProfiles, toCsv, updateProfile } from "@/lib/storeProfiles";
import { Download, ExternalLink, Plus, Search, Store, TrendingUp, Wallet, X } from "lucide-react";
import AdminAuthGate from "@/components/admin/AdminAuthGate";

const STATUS_TABS = ["Semua", "PAID", "PENDING", "EXPIRED", "FAILED"];
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const dateValue = (value) => value?.toDate ? value.toDate() : new Date(value || 0);
const dateText = (value) => value ? dateValue(value).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

function AdminDashboardContent() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [status, setStatus] = useState("Semua");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [customName, setCustomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeProfiles(setProfiles, (error) => {
    console.error("[v0] Failed to load store profiles:", error);
    setProfilesError(error?.code === "permission-denied" ? "Firebase menolak akses. Login admin dan periksa Firestore Rules." : "Profil toko gagal dimuat.");
    setLoading(false);
  }), []);
  useEffect(() => subscribeActiveProfile(setActiveId, (error) => {
    console.error("[v0] Failed to load active profile:", error);
    setProfilesError(error?.code === "permission-denied" ? "Firebase menolak akses. Login admin dan periksa Firestore Rules." : "Profil aktif gagal dimuat.");
  }), []);
  useEffect(() => {
    if (!activeId) { setOrders([]); setLoading(false); return undefined; }
    setLoading(true);
    return onSnapshot(query(collection(db, "orders"), where("store_id", "==", activeId)), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ order_id: item.id, ...item.data() }));
      next.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
      setOrders(next); setLoading(false);
    }, (error) => {
      console.error("[v0] Failed to load orders:", error);
      setLoading(false);
    });
  }, [activeId]);

  const filtered = useMemo(() => {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const date = dateValue(order.created_at);
      if (range === "today" && date < day) return false;
      if (range === "yesterday" && (date < new Date(day.getTime() - 86400000) || date >= day)) return false;
      if (status !== "Semua" && order.payment_status !== status) return false;
      return !term || `${order.order_id} ${order.customer_name || ""} ${order.customer_phone || ""}`.toLowerCase().includes(term);
    });
  }, [orders, range, search, status]);

  const metrics = useMemo(() => {
    const paid = filtered.filter((item) => item.payment_status === "PAID");
    const products = {};
    let hpp = 0;
    paid.forEach((order) => (order.items || []).forEach((item) => {
      const qty = Number(item.quantity || item.qty || 1);
      products[item.name] = (products[item.name] || 0) + qty;
      hpp += Number(item.hpp ?? item.base_cost ?? 0) * qty;
    }));
    return { revenue: paid.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), buyers: new Set(paid.map((item) => item.customer_phone || item.customer_name)).size, paid: paid.length, failed: filtered.filter((item) => ["FAILED", "EXPIRED"].includes(item.payment_status)).length, hpp, products: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [filtered]);

  async function handleCreate(event) {
    event.preventDefault();
    const name = customName.trim();
    if (!name || saving) return;
    setSaving(true); setCreateError("");
    try {
      const id = await createProfile(name);
      await setActiveProfile(id);
      setCustomName(""); setShowCreate(false);
    } catch (error) {
      console.error("[v0] Failed to create store profile:", error);
      setCreateError(error?.code === "permission-denied" ? "Akses ditolak Firebase. Login admin dan pastikan custom claim admin aktif." : "Toko gagal dibuat. Periksa koneksi lalu coba lagi.");
    } finally { setSaving(false); }
  }
  async function toggleProfile(profile) {
    if (saving) return;
    setSaving(true); setProfilesError("");
    try {
      await updateProfile(profile.id, { enabled: !profile.enabled });
      if (!profile.enabled) await setActiveProfile(profile.id);
    } catch (error) {
      console.error("[v0] Failed to toggle store profile:", error);
      setProfilesError(error?.code === "permission-denied" ? "Akses ditolak Firebase. Login admin untuk mengubah profil toko." : "Perubahan profil gagal disimpan.");
    } finally { setSaving(false); }
  }
  function downloadCsv() {
    const blob = new Blob([toCsv(filtered.map((order) => ({ id: order.order_id, waktu: dateText(order.created_at), pembeli: order.customer_name, whatsapp: order.customer_phone, total: order.total_amount, status: order.payment_status })))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `orders-${activeId || "store"}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  const activeName = profiles.find((profile) => profile.id === activeId)?.name;
  return <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-5"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">TokoSedes / Admin</p><h1 className="mt-1 font-display text-2xl font-semibold">Store control center</h1></div><div className="flex gap-2"><Link href="/" target="_blank" className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm"><ExternalLink size={15} /> Lihat toko</Link><button type="button" onClick={() => { setCreateError(""); setShowCreate(true); }} className="flex items-center gap-2 rounded-md bg-[var(--marigold)] px-3 py-2 text-sm font-semibold"><Plus size={16} /> Toko baru</button></div></div></header>
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
      {profilesError && <div role="alert" className="rounded-md border border-[var(--brick)] bg-[var(--paper)] px-4 py-3 text-sm text-[var(--brick)]">{profilesError}</div>}
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[0.05em] text-[var(--muted)]">Profil toko</p><h2 className="font-display text-xl font-semibold">Pilih workspace aktif</h2></div><span className="text-xs text-[var(--muted)]">{profiles.length} profil</span></div>{profiles.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--outline-variant)] bg-[var(--paper)] p-8 text-center"><div className="mb-4 flex size-12 items-center justify-center rounded-md bg-[var(--canvas)]"><Store size={22} /></div><h3 className="font-display text-lg font-semibold">Belum ada toko</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Buat store profile pertama untuk mulai mengatur katalog, checkout, dan analytics.</p><button type="button" onClick={() => setShowCreate(true)} className="mt-5 flex items-center gap-2 rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--paper)]"><Plus size={16} /> Buat toko pertama</button></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((profile) => <article key={profile.id} className={`rounded-lg border bg-[var(--paper)] p-4 ${profile.id === activeId ? "border-[var(--ink)] shadow-sm" : "border-[var(--line)]"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-[var(--canvas)]"><Store size={18} /></div><div><h3 className="font-semibold">{profile.name}</h3><p className="font-mono text-[11px] text-[var(--muted)]">{profile.id}</p></div></div><button type="button" aria-label={`Toggle ${profile.name}`} disabled={saving} onClick={() => toggleProfile(profile)} className={`relative h-6 w-11 rounded-full ${profile.enabled ? "bg-[var(--pine)]" : "bg-[var(--muted)]"}`}><span className={`absolute top-1 size-4 rounded-full bg-[var(--paper)] transition-transform ${profile.enabled ? "translate-x-6" : "translate-x-1"}`} /></button></div><div className="mt-4 flex items-center justify-between text-xs"><span className={profile.enabled ? "text-[var(--pine)]" : "text-[var(--muted)]"}>{profile.enabled ? "ON • aktif" : "OFF • nonaktif"}</span><button type="button" disabled={!profile.enabled || saving} onClick={() => setActiveProfile(profile.id)} className="font-semibold underline disabled:opacity-40">Gunakan</button></div></article>)}</div>}</section>
      <section className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.05em] text-[var(--muted)]">Analytics</p><h2 className="font-display text-xl font-semibold">{activeName || (profiles.length ? "Pilih profil toko" : "Belum ada data")}</h2></div><div className="flex flex-wrap gap-2"><select aria-label="Rentang waktu" value={range} onChange={(e) => setRange(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs"><option value="all">Semua waktu</option><option value="today">Hari ini</option><option value="yesterday">Kemarin</option></select><button type="button" disabled={!filtered.length} onClick={downloadCsv} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold disabled:opacity-40"><Download size={14} /> CSV</button></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Wallet size={17} />} label="Revenue" value={money(metrics.revenue)} /><Metric icon={<TrendingUp size={17} />} label="Net profit" value={money(metrics.revenue - metrics.hpp)} /><Metric label="Pembeli" value={metrics.buyers} /><Metric label="PAID / gagal" value={`${metrics.paid} / ${metrics.failed}`} /></div>{profiles.length > 0 && <><div className="flex flex-wrap gap-2"><div className="relative min-w-64 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input aria-label="Cari pesanan" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pembeli, WhatsApp, ID pesanan" className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] py-2 pl-9 pr-3 text-sm" /></div>{STATUS_TABS.map((item) => <button type="button" key={item} onClick={() => setStatus(item)} className={`rounded-full border px-3 py-2 text-xs ${status === item ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"}`}>{item}</button>)}</div><div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--paper)]"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-[var(--line)] text-xs uppercase tracking-wide text-[var(--muted)]"><tr><th className="px-4 py-3">ID pesanan</th><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Pembeli</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-[var(--muted)]">Memuat pesanan...</td></tr> : filtered.length ? filtered.map((order) => <tr key={order.order_id} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--canvas)]"><td className="px-4 py-3 font-mono text-xs">{order.order_id}</td><td className="px-4 py-3 text-xs text-[var(--muted)]">{dateText(order.created_at)}</td><td className="px-4 py-3">{order.customer_name || "-"}</td><td className="px-4 py-3 font-mono">{money(order.total_amount)}</td><td className="px-4 py-3 text-xs font-semibold">{order.payment_status || "-"}</td></tr>) : <tr><td colSpan="5" className="px-4 py-8 text-center text-[var(--muted)]">Belum ada pesanan pada filter ini.</td></tr>}</tbody></table></div></>}</section>
    </main>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/40 p-4" role="presentation"><form onSubmit={handleCreate} className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="flex items-center justify-between"><h2 id="create-title" className="font-display text-lg font-semibold">Buat profil toko</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Tutup"><X size={18} /></button></div><label htmlFor="store-name" className="text-sm font-semibold">Nama toko</label><input id="store-name" autoFocus required minLength={2} maxLength={80} value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Contoh: Toko Sedes" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />{createError && <p role="alert" className="text-sm text-[var(--brick)]">{createError}</p>}<button disabled={saving} className="rounded-md bg-[var(--marigold)] px-4 py-2 text-sm font-semibold disabled:opacity-60">{saving ? "Menyimpan..." : "Buat & aktifkan"}</button></form></div>}
  </div>;
}
export default function AdminDashboardPage() {
  return <AdminAuthGate><AdminDashboardContent /></AdminAuthGate>;
}

function Metric({ icon, label, value }) { return <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div><p className="mt-2 font-mono text-xl font-semibold">{value}</p></div>; }

// Analytics are intentionally disabled until a store profile exists; no mock data is shown.

// end
