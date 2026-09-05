"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Store, 
  ShoppingCart, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Clock, 
  ChevronRight,
  Package,
  AlertCircle
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// --- HELPER FUNCTIONS (KONSISTEN DENGAN HALAMAN ORDERS) ---
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

function getOrderDate(createdAt) {
  if (!createdAt) return new Date();
  if (createdAt.toDate) return createdAt.toDate();
  return new Date(createdAt);
}

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#14213D] p-4 md:p-8">
      <AdminDashboardContent />
    </div>
  );
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("storeid") || "";

  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

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
          ords.sort((a, b) => getOrderDate(b.created_at) - getOrderDate(a.created_at));
          setOrders(ords);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeId]);

  // Ambil profil aktif & field kustom toko secara dinamis dari database
  const activeProfile = profiles.find((p) => p.id === activeId);
  const storeFields = activeProfile?.settings?.custom_form_fields || [];
  const phoneFieldId = getPhoneFieldId(storeFields);
  const nameFieldId = getNameFieldId(storeFields);

  const paidOrders = orders.filter((o) => o.payment_status === "PAID");
  const totalOmzet = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const uniqueBuyers = new Set(paidOrders.map((o) => o.customer_phone).filter(Boolean)).size;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-1">
            Order Management / {activeId || "Store"}
          </div>
          <h1 className="text-2xl font-bold text-[#14213D]">Dashboard Toko</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orders?storeid=${activeId}`}
            className="flex items-center gap-2 px-4 py-2 bg-[#14213D] text-white text-sm font-semibold rounded-xl shadow hover:opacity-90 transition"
          >
            <ShoppingCart className="w-4 h-4" /> Kelola Semua Orders & Analytics <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Kartu Statistik Singkat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E4E4E0] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-[#FCA311] rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#6B7280] font-medium">TOTAL OMZET (PAID)</div>
            <div className="text-xl font-bold text-[#14213D] mt-0.5">Rp{totalOmzet.toLocaleString()}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E4E4E0] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#6B7280] font-medium">TOTAL PESANAN PAID</div>
            <div className="text-xl font-bold text-[#14213D] mt-0.5">{paidOrders.length} Pesanan</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E4E4E0] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#6B7280] font-medium">PEMBELI UNIK</div>
            <div className="text-xl font-bold text-[#14213D] mt-0.5">{uniqueBuyers} Orang</div>
          </div>
        </div>
      </div>

      {/* Tabel Pesanan Terbaru */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E4E4E0] overflow-hidden">
        <div className="p-4 border-b border-[#E4E4E0] flex justify-between items-center">
          <h2 className="font-bold text-[#14213D] text-base">Pesanan Terbaru</h2>
          <Link href={`/admin/orders?storeid=${activeId}`} className="text-xs font-semibold text-[#FCA311] hover:underline">
            Lihat Semua →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F4F0] text-xs font-semibold text-[#6B7280] border-b border-[#E4E4E0]">
                <th className="p-3">Order ID</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Pembeli & Data Kustom</th>
                <th className="p-3">Items</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E0] text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-[#6B7280]">Memuat data dashboard...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-[#6B7280]">Belum ada pesanan masuk.</td>
                </tr>
              ) : (
                orders.slice(0, 5).map((order) => {
                  const d = getOrderDate(order.created_at);
                  return (
                    <tr key={order.id || order.order_id} className="hover:bg-[#F9F9F8] transition">
                      <td className="p-3 font-medium text-[#14213D]">{order.order_id}</td>
                      <td className="p-3 text-xs text-[#6B7280]">
                        {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-[#14213D]">{order.customer_name || "-"}</div>
                        <div className="text-xs text-[#6B7280] mb-1">{order.customer_phone || "-"}</div>
                        
                        {/* Render Data Custom Form Secara Dinamis Sesuai Pengaturan Admin */}
                        {order.custom_field_responses && Object.keys(order.custom_field_responses).some((k) => k !== phoneFieldId && k !== nameFieldId) && (
                          <div className="mt-1.5 flex flex-col gap-0.5 border-t border-[#E4E4E0] pt-1.5">
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