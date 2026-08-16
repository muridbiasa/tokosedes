"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import {
  Plus,
  Wallet,
  CheckCircle2,
  TrendingUp,
  Search,
  CloudUpload,
  CloudOff,
} from "lucide-react";

/**
 * app/admin/dashboard/page.js
 *
 * Dashboard Admin — Mode Produksi (Terhubung ke Firestore Real-time)
 */

const STATUS_TABS = ["Semua", "PAID", "PENDING", "EXPIRED"];

const STATUS_STYLE = {
  PAID: "bg-[var(--pine)]/10 text-[var(--pine)]",
  PENDING: "bg-[var(--marigold)]/15 text-[var(--ink)]",
  EXPIRED: "bg-[var(--brick)]/10 text-[var(--brick)]",
  CANCELLED: "bg-[var(--muted)]/10 text-[var(--muted)]",
  FAILED: "bg-[var(--brick)]/10 text-[var(--brick)]",
};

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

// Menangani format waktu dari Firestore Timestamp atau String biasa
function formatDateTime(val) {
  if (!val) return "-";
  const date = val.toDate ? val.toDate() : new Date(val);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemsSummary(items) {
  if (!items || !Array.isArray(items)) return "-";
  return items.map((it) => `${it.name} (x${it.quantity || it.qty || 1})`).join(", ");
}

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState("Semua");
  const [search, setSearch] = useState("");

  // State Baru untuk Produksi
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const storeInfo = { store_name: "Toko Sedes", store_slug: "tokosedes-prod" };

  // Menarik Data Pesanan Real-time dari Firestore
  useEffect(() => {
    // FIX: field di Firestore adalah "store_id" (bukan "storeId")
    const q = query(
      collection(db, "orders"),
      where("store_id", "==", "tokosedes-prod")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = [];
      snapshot.forEach((doc) => {
        fetchedOrders.push({ order_id: doc.id, ...doc.data() });
      });

      // Urutkan manual (karena Firestore butuh index composite jika menggabungkan where dan orderBy)
      fetchedOrders.sort((a, b) => {
        const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at || 0);
        const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at || 0);
        return dateB - dateA; // Descending (terbaru di atas)
      });

      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Gagal mengambil data pesanan:", error);
      setLoading(false);
    });

    return () => unsubscribe(); // Bersihkan listener saat pindah halaman
  }, []);

  // Menghitung Statistik Omset & Produk Terlaris secara Otomatis
  const analyticsSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalTransactions = 0;
    const salesMap = {};

    orders.forEach(order => {
      if (order.payment_status === "PAID") {
        totalRevenue += (order.total_amount || 0);
        totalTransactions += 1;

        (order.items || []).forEach(item => {
          const qty = item.quantity || item.qty || 1;
          salesMap[item.name] = (salesMap[item.name] || 0) + qty;
        });
      }
    });

    const productSales = Object.entries(salesMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3); // Ambil 3 terlaris

    return { total_revenue: totalRevenue, total_transactions: totalTransactions, product_sales: productSales };
  }, [orders]);

  // Filter Search & Tab Status
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => (activeTab === "Semua" ? true : o.payment_status === activeTab))
      .filter((o) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          (o.customer_name || "").toLowerCase().includes(q) ||
          (o.order_id || "").toLowerCase().includes(q)
        );
      });
  }, [activeTab, search, orders]);

  // Hitung jumlah tiap tab
  const tabCounts = useMemo(() => {
    const counts = { Semua: orders.length };
    for (const status of ["PAID", "PENDING", "EXPIRED"]) {
      counts[status] = orders.filter((o) => o.payment_status === status).length;
    }
    return counts;
  }, [orders]);

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* --- Header Admin --- */}
      <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--ink)]">
              Dashboard Admin
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {storeInfo.store_name} — {storeInfo.store_slug}
            </p>
          </div>
          <Link
            href="/admin/produk/baru"
            className="flex items-center gap-1.5 rounded-md bg-[var(--marigold)] px-4 py-2 text-sm font-semibold text-[var(--ink)] shadow-sm hover:brightness-95"
          >
            <Plus size={15} /> Tambah Produk Baru
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        {/* --- Kartu Metrik --- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            icon={<Wallet size={18} />}
            label="Total Omset"
            value={formatRupiah(analyticsSummary.total_revenue)}
            hint="Dari pesanan berstatus PAID"
          />
          <MetricCard
            icon={<CheckCircle2 size={18} />}
            label="Transaksi Berhasil"
            value={analyticsSummary.total_transactions}
            hint="Total pesanan PAID"
          />
          <TopProductsCard products={analyticsSummary.product_sales} />
        </section>

        {/* --- Tabel Riwayat Pesanan --- */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Riwayat Pesanan {loading && <span className="text-xs text-blue-500 lowercase">(Memuat...)</span>}
            </h2>

            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama pembeli / ID pesanan"
                className="w-64 rounded-md border border-[var(--line)] bg-[var(--paper)] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--marigold)]"
              />
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab
                    ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                    : "border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"
                  }`}
              >
                {tab} {tabCounts[tab] !== undefined && `(${tabCounts[tab]})`}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--paper)]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">ID Pesanan</th>
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Pembeli</th>
                  <th className="px-4 py-3 font-medium">No. HP</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Sheets</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.order_id}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--canvas)]/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--ink)]">
                      {order.order_id}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink)]">{order.customer_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {order.customer_phone}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-4 py-3 text-xs text-[var(--muted)]"
                      title={itemsSummary(order.items)}
                    >
                      {itemsSummary(order.items)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--ink)]">
                      {formatRupiah(order.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLE[order.payment_status] ||
                          "bg-[var(--muted)]/10 text-[var(--muted)]"
                          }`}
                      >
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {order.synced_to_sheets ? (
                        <span className="flex items-center gap-1 text-xs text-[var(--pine)]">
                          <CloudUpload size={14} /> Tersinkron
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                          <CloudOff size={14} /> Menunggu
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {!loading && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                      Tidak ada pesanan yang cocok di database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-[var(--ink)]">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function TopProductsCard({ products }) {
  const maxQty = Math.max(...(products || []).map((p) => p.qty), 1);

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <TrendingUp size={18} />
        <span className="text-xs font-medium uppercase tracking-wide">Produk Terlaris</span>
      </div>

      {(!products || products.length === 0) ? (
        <p className="mt-4 text-xs text-[var(--muted)]">Belum ada data penjualan.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {products.map((p) => (
            <li key={p.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate pr-2 text-[var(--ink)]">{p.name}</span>
                <span className="shrink-0 font-mono text-[var(--muted)]">{p.qty} terjual</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--canvas)]">
                <div
                  className="h-full rounded-full bg-[var(--marigold)] transition-all duration-500"
                  style={{ width: `${(p.qty / maxQty) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}