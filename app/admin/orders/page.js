"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Download, 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  Store,
  ChevronLeft
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

// --- HELPER FUNCTIONS UNTUK FIELD KUSTOM ---
function normalizeFieldType(type) {
  const map = { short_text: "text", long_text: "textarea", tel: "phone" };
  return map[type] || type || "text";
}

function getPhoneFieldId(fields) {
  const f = fields.find((f) => normalizeFieldType(f.type) === "phone") ||
            fields.find((f) => /whatsapp|\bwa\b|no\.?\s*hp|nomor\s*(telepon|hp|whatsapp)|\bphone\b|\btel\b/i.test(f.label || ""));
  return f ? f.field_id : null;
}

function getNameFieldId(fields) {
  const f = fields.find((f) => normalizeFieldType(f.type) !== "phone" && /nama/i.test(f.label || "")) ||
            fields.find((f) => normalizeFieldType(f.type) === "text");
  return f ? f.field_id : null;
}

function filterOrders(orders, { status, search, range, from, to }) {
  return orders.filter((o) => {
    if (status && status !== "ALL" && o.payment_status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = (o.order_id || "").toLowerCase().includes(q);
      const matchName = (o.customer_name || "").toLowerCase().includes(q);
      const matchPhone = (o.customer_phone || "").toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPhone) return false;
    }
    return true;
  });
}

function getAnalytics(orders) {
  let omzet = 0;
  let grossProfit = 0;
  let netProfit = 0;
  let uniqueBuyers = new Set();
  let paidCount = 0;
  let failedCount = 0;
  let productSales = {};

  orders.forEach((o) => {
    const isPaid = o.payment_status === "PAID";
    if (isPaid) {
      omzet += Number(o.total_amount || 0);
      paidCount++;
      if (o.customer_phone) uniqueBuyers.add(o.customer_phone);

      let orderHpp = 0;
      (o.items || []).forEach((item) => {
        const hppItem = Number(item.hpp ?? item.base_cost ?? 0);
        const qty = Number(item.qty || 0);
        orderHpp += hppItem * qty;

        const key = `${item.name} - ${item.variant || 'Default'}`;
        if (!productSales[key]) {
          productSales[key] = { name: item.name, variant: item.variant, qty: 0, revenue: 0 };
        }
        productSales[key].qty += qty;
        productSales[key].revenue += Number(item.price || 0) * qty;
      });

      const profit = Number(o.total_amount || 0) - orderHpp;
      grossProfit += profit;
      netProfit += profit;
    } else {
      failedCount++;
    }
  });

  const topSellers = Object.values(productSales).sort((a, b) => b.qty - a.qty);

  return {
    omzet,
    grossProfit,
    netProfit,
    uniqueBuyers: uniqueBuyers.size,
    paidCount,
    failedCount,
    topSellers,
  };
}

function getOrderDate(createdAt) {
  if (!createdAt) return new Date();
  if (createdAt.toDate) return createdAt.toDate();
  return new Date(createdAt);
}

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#14213D] p-4 md:p-8">
      <OrdersContent />
    </div>
  );
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("storeid") || "";

  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const profSnap = await getDocs(collection(db, "profiles"));
        const profs = profSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProfiles(profs);

        if (activeId) {
          const ordSnap = await getDocs(collection(db, "profiles", activeId, "orders"));
          const ords = ordSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOrders(ords);
        }
      } catch (err) {
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeId]);

  const filtered = useMemo(() => filterOrders(orders, { status, search, range, from, to }), [orders, status, search, range, from, to]);
  const analytics = useMemo(() => getAnalytics(filtered), [filtered]);

  // Ambil profil aktif dan pengaturan field kustom secara dinamis
  const activeProfile = profiles.find((p) => p.id === activeId);
  const storeFields = activeProfile?.settings?.custom_form_fields || [];
  const phoneFieldId = getPhoneFieldId(storeFields);
  const nameFieldId = getNameFieldId(storeFields);

  // Fungsi download laporan dinamis ke Excel (Tab-Separated)
  function download() {
    const standardHeaders = [
      "Order ID",
      "Tanggal",
      "Pembeli",
      "No. WhatsApp",
      "Items",
      "Total (Rp)",
      "HPP (Rp)",
      "Profit (Rp)",
      "Status",
    ];

    const dynamicFields = storeFields.filter(
      (f) => f.field_id !== phoneFieldId && f.field_id !== nameFieldId
    );
    const dynamicHeaders = dynamicFields.map((f) => f.label);
    const headers = [...standardHeaders, ...dynamicHeaders];

    const rows = filtered.map((order) => {
      const baseRow = [
        order.order_id,
        getOrderDate(order.created_at).toISOString().replace("T", " ").substring(0, 19),
        order.customer_name || "-",
        order.customer_phone ? `'${order.customer_phone}` : "-",
        (order.items || []).map((i) => `${i.name} x${i.qty}`).join("; "),
        order.total_amount || 0,
        (order.items || []).reduce((sum, i) => sum + Number(i.hpp ?? i.base_cost ?? 0) * Number(i.qty || 0), 0),
        Number(order.total_amount || 0) - (order.items || []).reduce((sum, i) => sum + Number(i.hpp ?? i.base_cost ?? 0) * Number(i.qty || 0), 0),
        order.payment_status || "-",
      ];

      const dynamicValues = dynamicFields.map((f) => {
        const val = order.custom_field_responses?.[f.field_id];
        if (!val) return "-";
        return Array.isArray(val) ? val.join(", ") : val;
      });

      return [...baseRow, ...dynamicValues];
    });

    const csvContent = [
      headers.join("\t"),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join("\t")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan-Orders-${activeId || "store"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-1">
            <Link href={`/admin/dashboard?storeid=${activeId}`} className="hover:underline flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Dashboard
            </Link>
            <span>/</span>
            <span>Order Management</span>
          </div>
          <h1 className="text-2xl font-bold text-[#14213D]">Orders & Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={download}
            className="flex items-center gap-2 px-4 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-xl shadow hover:opacity-90 transition"
          >
            <Download className="w-4 h-4" /> Download report
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-[#E4E4E0] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Cari pembeli atau Order ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#E4E4E0] rounded-xl text-sm focus:outline-none focus:border-[#14213D]"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {["ALL", "PAID", "PENDING", "EXPIRED", "FAILED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                status === st ? "bg-[#14213D] text-white" : "bg-[#F4F4F0] text-[#6B7280] hover:bg-[#E4E4E0]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">OMZET</div>
          <div className="text-lg font-bold text-[#14213D] mt-1">Rp{analytics.omzet.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">GROSS PROFIT</div>
          <div className="text-lg font-bold text-[#14213D] mt-1">Rp{analytics.grossProfit.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">NET PROFIT</div>
          <div className="text-lg font-bold text-[#14213D] mt-1">Rp{analytics.netProfit.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">PEMBELI UNIK</div>
          <div className="text-lg font-bold text-[#14213D] mt-1">{analytics.uniqueBuyers}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">PAID</div>
          <div className="text-lg font-bold text-green-600 mt-1">{analytics.paidCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
          <div className="text-xs text-[#6B7280] font-medium">GAGAL / EXPIRED</div>
          <div className="text-lg font-bold text-red-500 mt-1">{analytics.failedCount}</div>
        </div>
      </div>

      {/* Table Orders */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E4E4E0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F4F0] text-xs font-semibold text-[#6B7280] border-b border-[#E4E4E0]">
                <th className="p-3">Order ID</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Pembeli</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E0] text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-[#6B7280]">Memuat data pesanan...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-[#6B7280]">Tidak ada pesanan ditemukan.</td>
                </tr>
              ) : (
                filtered.map((order) => {
                  const d = getOrderDate(order.created_at);
                  return (
                    <tr key={order.id || order.order_id} className="hover:bg-[#F9F9F8] transition">
                      <td className="p-3 font-medium text-[#14213D]">{order.order_id}</td>
                      <td className="p-3 text-xs text-[#6B7280]">
                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-[#14213D]">{order.customer_name || "-"}</div>
                        <div className="text-xs text-[#6B7280]">{order.customer_phone || "-"}</div>
                        
                        {/* Dynamic Custom Field Responses */}
                        {order.custom_field_responses && Object.keys(order.custom_field_responses).some((k) => k !== phoneFieldId && k !== nameFieldId) && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-[#E4E4E0] pt-1.5">
                            {Object.entries(order.custom_field_responses)
                              .filter(([key]) => key !== phoneFieldId && key !== nameFieldId)
                              .map(([key, val]) => {
                                const field = storeFields.find((f) => f.field_id === key);
                                const label = field ? field.label : key;
                                const valStr = Array.isArray(val) ? val.join(", ") : val;
                                if (!valStr) return null;
                                return (
                                  <span key={key} className="text-[11px] text-[#6B7280] leading-tight">
                                    <span className="font-medium text-[#14213D]">{label}:</span> {valStr}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs space-y-0.5">
                          {(order.items || []).map((i, idx) => (
                            <div key={idx} className="text-[#14213D]">
                              {i.name} <span className="text-[#6B7280]">x{i.qty}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-[#14213D]">
                        Rp{(order.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                            order.payment_status === "PAID"
                              ? "bg-green-100 text-green-700"
                              : order.payment_status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {order.payment_status || "PENDING"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}