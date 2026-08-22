"use client";

import { useMemo } from "react";

const money = (value) => `Rp${Number(value || 0).toLocaleString("id-ID")}`;

export function getOrderDate(value) {
  if (value?.toDate) return value.toDate();
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function filterOrders(orders, { status, search, range, from, to }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return orders.filter((order) => {
    const date = getOrderDate(order.created_at);
    if (range === "today" && date < today) return false;
    if (range === "yesterday") {
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      if (date < yesterday || date >= today) return false;
    }
    if (range === "custom") {
      if (from && date < new Date(`${from}T00:00:00`)) return false;
      if (to && date >= new Date(`${to}T23:59:59.999`)) return false;
    }
    if (status !== "ALL" && order.payment_status !== status) return false;
    const term = search.trim().toLowerCase();
    return !term || `${order.order_id} ${order.customer_name || ""} ${order.customer_phone || ""}`.toLowerCase().includes(term);
  });
}

export function getAnalytics(orders) {
  const paid = orders.filter((order) => order.payment_status === "PAID");
  const top = new Map();
  let revenue = 0; let hpp = 0;
  paid.forEach((order) => {
    revenue += Number(order.total_amount || 0);
    (order.items || []).forEach((item) => {
      const quantity = Math.max(0, Number(item.qty ?? item.quantity ?? 0));
      hpp += Number(item.hpp ?? item.base_cost ?? 0) * quantity;
      const key = `${item.name || "Item"}${item.sku ? ` · ${item.sku}` : ""}`;
      top.set(key, (top.get(key) || 0) + quantity);
    });
  });
  return { revenue, hpp, grossProfit: revenue - hpp, netProfit: revenue - hpp, paid: paid.length, failed: orders.filter((order) => ["FAILED", "EXPIRED", "CANCELLED"].includes(order.payment_status)).length, buyers: new Set(paid.map((order) => order.customer_phone || order.customer_name).filter(Boolean)).size, top: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
}

export function AnalyticsCards({ analytics }) {
  const cards = [["Omzet", money(analytics.revenue)], ["Gross profit", money(analytics.grossProfit)], ["Net profit", money(analytics.netProfit)], ["Pembeli unik", analytics.buyers], ["Paid", analytics.paid], ["Gagal / expired", analytics.failed]];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, value]) => <article key={label} className="rounded-md border border-[#E4E4E0] bg-white p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#6B7280]">{label}</p><p className="mt-2 font-mono text-xl font-medium text-[#14213D]">{value}</p></article>)}</div>;
}

export function TopSellers({ items }) {
  return <section className="rounded-md border border-[#E4E4E0] bg-white p-4"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold text-[#14213D]">Top sellers</h2><span className="text-xs text-[#6B7280]">paid orders</span></div><div className="mt-4 flex flex-col gap-3">{items.length ? items.map(([name, quantity], index) => <div className="flex items-center justify-between gap-3 text-sm" key={name}><span className="truncate"><span className="mr-2 font-mono text-xs text-[#6B7280]">{String(index + 1).padStart(2, "0")}</span>{name}</span><span className="font-mono text-xs">{quantity} pcs</span></div>) : <p className="text-sm text-[#6B7280]">Belum ada penjualan pada rentang ini.</p>}</div></section>;
}

export { money };
export default function Analytics({ orders }) { return <AnalyticsCards analytics={useMemo(() => getAnalytics(orders), [orders])} />; }
