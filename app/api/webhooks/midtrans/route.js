/**
 * app/api/webhooks/midtrans/route.js
 *
 * POST /api/webhooks/midtrans
 *
 * Menerima notifikasi (webhook) dari Midtrans Production.
 * SATU-SATUNYA TEMPAT yang boleh mengubah payment_status menjadi PAID.
 *
 * PERBAIKAN:
 * - Query langsung ke root collection "orders" (bukan collectionGroup)
 * - Signature verification tetap dipertahankan
 * - Rollback stok jika EXPIRED/CANCELLED
 * - Sync ke Google Sheets jika PAID
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { getServerKey } from "@/lib/midtrans";
import { appendOrderToSheets } from "@/lib/google-sheets";

export const maxDuration = 30;

function verifySignature({ order_id, status_code, gross_amount, signature_key }) {
  const serverKey = getServerKey();
  const raw = `${order_id}${status_code}${gross_amount}${serverKey}`;
  const expected = crypto.createHash("sha512").update(raw).digest("hex");
  return expected === signature_key;
}

function mapPaymentStatus(transactionStatus, fraudStatus) {
  if (
    (transactionStatus === "settlement" || transactionStatus === "capture") &&
    (fraudStatus === "accept" || fraudStatus === undefined)
  ) {
    return "PAID";
  }
  if (transactionStatus === "pending") return "PENDING";
  if (transactionStatus === "expire") return "EXPIRED";
  if (transactionStatus === "cancel" || transactionStatus === "deny") return "CANCELLED";
  return null;
}

/**
 * Cari dokumen order berdasarkan order_id di ROOT COLLECTION "orders".
 * (Perbaikan: sebelumnya menggunakan collectionGroup)
 */
async function findOrderByOrderId(orderId) {
  const snapshot = await db
    .collection("orders")
    .where("order_id", "==", orderId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

/**
 * Kembalikan stok item-item sebuah order yang EXPIRED/CANCELLED.
 */
async function releaseStock(orderData) {
  const storeRef = db.collection("stores").doc(orderData.store_id);

  await db.runTransaction(async (transaction) => {
    for (const item of orderData.items) {
      const productRef = storeRef.collection("products").doc(item.product_id);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) continue;

      const product = productSnap.data();

      if (product.has_variants && Array.isArray(product.variants)) {
        const variantIndex = product.variants.findIndex((v) => v.sku === item.sku);
        if (variantIndex === -1) continue;

        const nextVariants = [...product.variants];
        nextVariants[variantIndex] = {
          ...nextVariants[variantIndex],
          stock: nextVariants[variantIndex].stock + item.qty,
        };
        transaction.update(productRef, { variants: nextVariants });
      } else {
        const currentStock = product.base_stock ?? product.stock ?? 0;
        const newStock = currentStock + item.qty;
        transaction.update(productRef, {
          base_stock: newStock,
          stock: product.stock !== undefined ? newStock : undefined,
        });
      }
    }
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    console.error("[webhooks/midtrans] Body notifikasi bukan JSON valid");
    return NextResponse.json({ status: "OK" });
  }

  const {
    order_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    transaction_id,
    payment_type,
    transaction_time,
    settlement_time,
  } = payload || {};

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    console.error("[webhooks/midtrans] Payload tidak lengkap:", payload);
    return NextResponse.json({ status: "OK" });
  }

  // --- 1. Verifikasi signature ---
  const isValidSignature = verifySignature({
    order_id,
    status_code,
    gross_amount,
    signature_key,
  });

  if (!isValidSignature) {
    console.error(
      `[webhooks/midtrans] SIGNATURE TIDAK VALID untuk order_id=${order_id}. Notifikasi diabaikan.`
    );
    return NextResponse.json({ status: "invalid signature" }, { status: 401 });
  }

  // --- 2. Cari dokumen order di ROOT COLLECTION ---
  const orderDoc = await findOrderByOrderId(order_id);

  if (!orderDoc) {
    console.error(`[webhooks/midtrans] order_id=${order_id} tidak ditemukan di Firestore.`);
    return NextResponse.json({ status: "OK" });
  }

  const newPaymentStatus = mapPaymentStatus(transaction_status, fraud_status);

  if (!newPaymentStatus) {
    console.log(
      `[webhooks/midtrans] transaction_status="${transaction_status}" tidak dipetakan, tidak ada perubahan untuk order_id=${order_id}.`
    );
    return NextResponse.json({ status: "OK" });
  }

  const orderRef = orderDoc.ref;
  const orderData = orderDoc.data();

  // --- 3. Update status pembayaran ---
  const updatePayload = {
    payment_status: newPaymentStatus,
    "midtrans.transaction_id": transaction_id || null,
    "midtrans.payment_type": payment_type || null,
    "midtrans.transaction_time": transaction_time || null,
    updated_at: FieldValue.serverTimestamp(),
  };

  if (newPaymentStatus === "PAID") {
    updatePayload["midtrans.settlement_time"] = settlement_time || null;
  }

  if (newPaymentStatus === "EXPIRED" || newPaymentStatus === "CANCELLED") {
    updatePayload.stock_status = "RELEASED";
    await releaseStock(orderData);
  }

  await orderRef.update(updatePayload);

  // --- 4. Sync ke Google Sheets (hanya untuk transaksi sukses) ---
  if (newPaymentStatus === "PAID") {
    try {
      const storeSnap = await db.collection("stores").doc(orderData.store_id).get();
      const storeName = storeSnap.exists ? storeSnap.data().store_name : "";

      await appendOrderToSheets({
        order_id: orderData.order_id,
        created_at: orderData.created_at?.toDate?.().toISOString() || new Date().toISOString(),
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        items: orderData.items,
        total_amount: orderData.total_amount,
        payment_status: newPaymentStatus,
        midtrans_transaction_id: transaction_id || "",
        payment_type: payment_type || "",
        store_name: storeName,
      });

      await orderRef.update({
        synced_to_sheets: true,
        sheets_sync_error: null,
        updated_at: FieldValue.serverTimestamp(),
      });
    } catch (sheetsError) {
      console.error(
        `[webhooks/midtrans] Gagal sync ke Sheets untuk order_id=${order_id}:`,
        sheetsError
      );
      await orderRef.update({
        synced_to_sheets: false,
        sheets_sync_error: String(sheetsError?.message || sheetsError),
        updated_at: FieldValue.serverTimestamp(),
      });
    }
  }

  // --- 5. Balas OK ke Midtrans ---
  return NextResponse.json({ status: "OK" });
}