"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createProfile, setActiveProfile, subscribeActiveProfile, subscribeProfiles, toCsv, updateProfile } from "@/lib/storeProfiles";
import { Download, ExternalLink, Plus, Search, Store, TrendingUp, Wallet, X } from "lucide-react";

const STATUS_TABS = ["Semua", "PAID", "PENDING", "EXPIRED", "FAILED"];
const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;
const dateValue = (value) => value?.toDate ? value.toDate() : new Date(value || 0);
const dateText = (value) => value ? dateValue(value).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export default function AdminDashboardPage() {
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Semua");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [customName, setCustomName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => subscribeProfiles(setProfiles, console.error), []);
  useEffect(() => subscribeActiveProfile(setActiveId, console.error), []);
  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    return onSnapshot(query(collection(db, "orders"), where("store_id", "==", activeId)), (snapshot) => {
      const next = snapshot.docs.map((item) => ({ order_id: item.id, ...item.data() }));
      next.sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at));
      setOrders(next);
      setLoading(false);
    }, (error) => { console.error(error); setLoading(false); });
  }, [activeId]);

  const filtered = useMemo(() => {
    const now = new Date();
    return orders.filter((order) => {
      const date = dateValue(order.created_at);
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (range === "today" && date < day) return false;
      if (range === "yesterday" && (date < new Date(day - 86400000) || date >= day)) return false;
      if (status !== "Semua" && order.payment_status !== status) return false;
      const term = search.trim().toLowerCase();
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
      hpp += Number(item.hpp || item.base_cost || 0) * qty;
    }));
    return { revenue: paid.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), buyers: new Set(paid.map((item) => item.customer_phone || item.customer_name)).size, paid: paid.length, failed: filtered.filter((item) => ["FAILED", "EXPIRED"].includes(item.payment_status)).length, hpp, products: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [filtered]);

  async function handleCreate(event) {
    event.preventDefault();
    const id = await createProfile(customName);
    await setActiveProfile(id);
    setCustomName(""); setShowCreate(false);
  }
  async function toggleProfile(profile) {
    await updateProfile(profile.id, { enabled: !profile.enabled });
    if (!profile.enabled) await setActiveProfile(profile.id);
  }
  function downloadCsv() {
    const blob = new Blob([toCsv(filtered.map((order) => ({ id: order.order_id, waktu: dateText(order.created_at), pembeli: order.customer_name, whatsapp: order.customer_phone, total: order.total_amount, status: order.payment_status })))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `orders-${activeId}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-5"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">TokoSedes / Admin</p><h1 className="mt-1 font-display text-2xl font-semibold">Store control center</h1></div><div className="flex gap-2"><Link href="/" target="_blank" className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm"><ExternalLink size={15}/> Lihat toko</Link><button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-md bg-[var(--marigold)] px-3 py-2 text-sm font-semibold"><Plus size={16}/> Toko baru</button></div></div></header>
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6">
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Profil toko</p><h2 className="font-display text-xl font-semibold">Pilih workspace aktif</h2></div><span className="text-xs text-[var(--muted)]">{profiles.length} profil</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{profiles.map((profile) => <article key={profile.id} className={`rounded-lg border bg-[var(--paper)] p-4 ${profile.id === activeId ? "border-[var(--ink)] shadow-sm" : "border-[var(--line)]"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-md bg-[var(--canvas)]"><Store size={18}/></div><div><h3 className="font-semibold">{profile.name}</h3><p className="font-mono text-[11px] text-[var(--muted)]">{profile.id}</p></div></div><button aria-label={`Toggle ${profile.name}`} onClick={() => toggleProfile(profile)} className={`relative h-6 w-11 rounded-full ${profile.enabled ? "bg-[var(--pine)]" : "bg-[var(--muted)]"}`}><span className={`absolute top-1 size-4 rounded-full bg-[var(--paper)] transition-transform ${profile.enabled ? "translate-x-6" : "translate-x-1"}`}/></button></div><div className="mt-4 flex items-center justify-between text-xs"><span className={profile.enabled ? "text-[var(--pine)]" : "text-[var(--muted)]"}>{profile.enabled ? "ON • aktif" : "OFF • nonaktif"}</span><button disabled={!profile.enabled} onClick={() => setActiveProfile(profile.id)} className="font-semibold underline disabled:opacity-40">Gunakan</button></div></article>)}</div></section>
      <section className="flex flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[var(--muted)]">Analytics</p><h2 className="font-display text-xl font-semibold">{profiles.find((p) => p.id === activeId)?.name || "Memuat profil"}</h2></div><div className="flex flex-wrap gap-2"><select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs"><option value="all">Semua waktu</option><option value="today">Hari ini</option><option value="yesterday">Kemarin</option></select><button onClick={downloadCsv} className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold"><Download size={14}/> CSV</button></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={<Wallet size={17}/>} label="Revenue" value={money(metrics.revenue)}/><Metric icon={<TrendingUp size={17}/>} label="Net profit" value={money(metrics.revenue - metrics.hpp)}/><Metric label="Pembeli" value={metrics.buyers}/><Metric label="PAID / gagal" value={`${metrics.paid} / ${metrics.failed}`}/></div><div className="flex flex-wrap gap-2"><div className="relative min-w-64 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pembeli, WhatsApp, ID pesanan" className="w-full rounded-md border border-[var(--line)] bg-[var(--paper)] py-2 pl-9 pr-3 text-sm"/></div>{STATUS_TABS.map((item) => <button key={item} onClick={() => setStatus(item)} className={`rounded-full border px-3 py-2 text-xs ${status === item ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"}`}>{item}</button>)}</div><div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--paper)]"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-wide text-[var(--muted)]"><tr>{["ID pesanan","Waktu","Pembeli","Item","Total","Status"].map((head) => <th key={head} className="px-4 py-3 font-medium">{head}</th>)}</tr></thead><tbody>{filtered.map((order) => <tr key={order.order_id} className="border-b border-[var(--line)] last:border-0"><td className="px-4 py-3 font-mono text-xs">{order.order_id}</td><td className="px-4 py-3 text-xs text-[var(--muted)]">{dateText(order.created_at)}</td><td className="px-4 py-3">{order.customer_name}<div className="text-xs text-[var(--muted)]">{order.customer_phone}</div></td><td className="max-w-56 truncate px-4 py-3 text-xs text-[var(--muted)]">{(order.items || []).map((item) => `${item.name} × ${item.quantity || item.qty || 1}`).join(", ") || "-"}</td><td className="px-4 py-3 font-mono">{money(order.total_amount)}</td><td className="px-4 py-3"><span className="rounded-full bg-[var(--canvas)] px-2 py-1 text-[11px]">{order.payment_status}</span></td></tr>)}{!loading && filtered.length === 0 && <tr><td colSpan="6" className="px-4 py-12 text-center text-sm text-[var(--muted)]">Belum ada pesanan untuk filter ini.</td></tr>}</tbody></table></div></section>
    </main>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/30 p-4"><form onSubmit={handleCreate} className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-[var(--paper)] p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Buat profil toko</h2><button type="button" onClick={() => setShowCreate(false)} aria-label="Tutup"><X size={18}/></button></div><input autoFocus required value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nama toko" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm"/><button className="rounded-md bg-[var(--marigold)] px-4 py-2 text-sm font-semibold">Buat & aktifkan</button></form></div>}
  </div>;
}
function Metric({ icon, label, value }) { return <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--muted)]">{icon}{label}</div><p className="mt-2 font-mono text-xl font-semibold">{value}</p></div>; }
