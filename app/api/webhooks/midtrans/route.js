import crypto from "crypto";
import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { getServerKey } from "@/lib/midtrans";
import { appendOrderToSheets } from "@/lib/google-sheets";

export const maxDuration = 30;

function verifySignature({ order_id, status_code, gross_amount, signature_key }) {
  const expected = crypto.createHash("sha512").update(`${order_id}${status_code}${gross_amount}${getServerKey()}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature_key)));
}
function mapPaymentStatus(transactionStatus, fraudStatus) {
  if ((transactionStatus === "settlement" || transactionStatus === "capture") && (fraudStatus === "accept" || fraudStatus === undefined)) return "PAID";
  if (transactionStatus === "pending") return "PENDING";
  if (transactionStatus === "expire") return "EXPIRED";
  if (["cancel", "deny"].includes(transactionStatus)) return "CANCELLED";
  return null;
}
async function findOrderByOrderId(orderId) {
  const snapshot = await db.collection("orders").where("order_id", "==", orderId).limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0];
}
async function releaseStock(orderData) {
  if (orderData.stock_status === "RELEASED") return;
  await db.runTransaction(async (transaction) => {
    const storeRef = db.collection("stores").doc(orderData.store_id);
    const refs = (orderData.items || []).map((item) => storeRef.collection("products").doc(item.product_id));
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    snapshots.forEach((snap, index) => {
      if (!snap.exists) return;
      const product = snap.data(); const item = orderData.items[index];
      if (product.has_variants && Array.isArray(product.variants)) {
        const variants = [...product.variants]; const variantIndex = variants.findIndex((v) => v.sku === item.sku);
        if (variantIndex < 0) return;
        variants[variantIndex] = { ...variants[variantIndex], stock: Number(variants[variantIndex].stock || 0) + Number(item.qty || 0) };
        transaction.update(refs[index], { variants });
      } else if (!product.unlimited_stock) {
        const stock = Number(product.base_stock ?? product.stock ?? 0) + Number(item.qty || 0);
        transaction.update(refs[index], { base_stock: stock, ...(product.stock !== undefined ? { stock } : {}) });
      }
    });
    transaction.update(db.collection("orders").doc(orderData.__docId), { stock_status: "RELEASED", updated_at: FieldValue.serverTimestamp() });
  });
}

export async function POST(request) {
  let payload;
  try { payload = await request.json(); } catch { return NextResponse.json({ status: "OK" }); }
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, transaction_id, payment_type, transaction_time, settlement_time } = payload || {};
  if (!order_id || !status_code || gross_amount == null || !signature_key) return NextResponse.json({ status: "OK" });
  try {
    if (String(signature_key).length !== 128 || !verifySignature({ order_id, status_code, gross_amount, signature_key })) return NextResponse.json({ status: "invalid signature" }, { status: 401 });
    const orderDoc = await findOrderByOrderId(order_id);
    if (!orderDoc) return NextResponse.json({ status: "OK" });
    const orderData = { __docId: orderDoc.id, ...orderDoc.data() };
    if (Number(gross_amount) !== Number(orderData.total_amount)) return NextResponse.json({ status: "amount mismatch" }, { status: 400 });
    const next = mapPaymentStatus(transaction_status, fraud_status); if (!next) return NextResponse.json({ status: "OK" });
    const current = orderData.payment_status;
    const rank = { PENDING: 1, PAID: 3, EXPIRED: 2, CANCELLED: 2, FAILED: 2 };
    if (current === "PAID" || (rank[next] || 0) < (rank[current] || 0)) return NextResponse.json({ status: "OK" });
    if (["EXPIRED", "CANCELLED"].includes(next) && current !== next) await releaseStock(orderData);
    const update = { payment_status: next, "midtrans.transaction_id": transaction_id || null, "midtrans.payment_type": payment_type || null, "midtrans.transaction_time": transaction_time || null, updated_at: FieldValue.serverTimestamp() };
    if (next === "PAID") update["midtrans.settlement_time"] = settlement_time || null;
    await orderDoc.ref.update(update);
    if (next === "PAID" && !orderData.synced_to_sheets) {
      try {
        const storeSnap = await db.collection("store_profiles").doc(orderData.store_id).get();
        await appendOrderToSheets({ ...orderData, payment_status: next, store_name: storeSnap.exists ? storeSnap.data().name : "", midtrans_transaction_id: transaction_id || "", payment_type: payment_type || "" });
        await orderDoc.ref.update({ synced_to_sheets: true, sheets_sync_error: null, updated_at: FieldValue.serverTimestamp() });
      } catch (error) { await orderDoc.ref.update({ synced_to_sheets: false, sheets_sync_error: "Sync gagal", updated_at: FieldValue.serverTimestamp() }); }
    }
    return NextResponse.json({ status: "OK" });
  } catch (error) { console.error("[webhooks/midtrans] processing error", error); return NextResponse.json({ status: "OK" }); }
}
