/**
 * app/api/webhooks/midtrans/route.js
 *
 * POST /api/webhooks/midtrans
 *
 * Menerima notifikasi (webhook) dari Midtrans Production setiap ada
 * perubahan status transaksi. INI SATU-SATUNYA TEMPAT yang boleh mengubah
 * payment_status jadi PAID — PRD Don'ts: "JANGAN memperbarui status
 * pembayaran... hanya berdasarkan redirect URL di sisi client. Wajib
 * menunggu Callback Webhook sah dari Midtrans."
 *
 * Alur:
 *   1. Verifikasi signature_key (SHA512) — tolak kalau tidak cocok.
 *   2. Cari dokumen order berdasarkan order_id (query collectionGroup,
 *      karena kita tidak tahu store_id dari payload webhook Midtrans).
 *   3. Mapping transaction_status -> payment_status internal.
 *   4. Kalau PAID: tulis status + panggil appendOrderToSheets().
 *   5. Selalu balas 200 { status: "OK" } ke Midtrans, KECUALI signature
 *      tidak valid (lihat catatan di bawah soal kenapa).
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
  return null; // status tidak dikenali -> jangan sentuh apa pun
}

/**
 * Cari dokumen order di seluruh toko berdasarkan order_id.
 * Payload webhook Midtrans hanya berisi order_id (bukan store_id), jadi
 * kita pakai collectionGroup query lintas semua stores/*\/orders.
 * SYARAT: field `order_id` pada tiap dokumen order harus ter-index
 * (Firestore otomatis meng-index field level-1 kecuali dinonaktifkan).
 */
async function findOrderByOrderId(orderId) {
  const snapshot = await db
    .collectionGroup("orders")
    .where("order_id", "==", orderId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    // Body bukan JSON valid -- tetap balas 200 supaya Midtrans tidak
    // retry notifikasi yang memang cacat, tapi log untuk investigasi.
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

  // --- 1. Verifikasi signature — WAJIB, lihat PRD Do's "Webhook Verification" ---
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
    // Sengaja balas 401 (bukan 200) untuk signature invalid: ini kemungkinan
    // notifikasi palsu/dipalsukan, bukan sekadar payload aneh dari Midtrans
    // asli — tidak ada alasan menenangkan pengirimnya dengan 200 OK.
    return NextResponse.json({ status: "invalid signature" }, { status: 401 });
  }

  // --- 2. Cari dokumen order terkait ---
  const orderDoc = await findOrderByOrderId(order_id);

  if (!orderDoc) {
    console.error(`[webhooks/midtrans] order_id=${order_id} tidak ditemukan di Firestore.`);
    // Balas 200 tetap -- order_id valid dari sisi Midtrans (signature cocok),
    // kemungkinan race condition dokumen belum ter-index atau data lama.
    // Membalas non-200 di sini akan membuat Midtrans retry tanpa henti
    // untuk kasus yang tidak akan pernah berhasil.
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
    // PRD §5.2 poin 3: lepas kembali stok ke etalase.
    updatePayload.stock_status = "RELEASED";
    await releaseStock(orderData);
  }

  await orderRef.update(updatePayload);

  // --- 4. Sync ke Google Sheets (hanya untuk transaksi sukses, F-06) ---
  if (newPaymentStatus === "PAID") {
    try {
      const storeSnap = await orderRef.parent.parent.get(); // stores/{storeId}
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
      // PRD §5.4: Firestore tetap Single Source of Truth. Kegagalan Sheets
      // TIDAK membatalkan pemrosesan webhook -- status PAID sudah tersimpan
      // di atas. Kita hanya menandai perlu di-retry oleh background job
      // terpisah (mis. scheduled function `retrySheetsSync`, di luar
      // cakupan berkas ini).
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

  // --- 5. Selalu balas OK ke Midtrans (mencegah retry notifikasi berulang) ---
  return NextResponse.json({ status: "OK" });
}

/** Kembalikan stok item-item sebuah order yang EXPIRED/CANCELLED. */
async function releaseStock(orderData) {
  const storeRef = db.collection("stores").doc(orderData.store_id);

  await db.runTransaction(async (transaction) => {
    for (const item of orderData.items) {
      const productRef = storeRef.collection("products").doc(item.product_id);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists) continue;

      const product = productSnap.data();

      if (product.has_variants) {
        const variantIndex = (product.variants || []).findIndex(
          (v) => v.sku === item.sku
        );
        if (variantIndex === -1) continue;

        const nextVariants = [...product.variants];
        nextVariants[variantIndex] = {
          ...nextVariants[variantIndex],
          stock: nextVariants[variantIndex].stock + item.qty,
        };
        transaction.update(productRef, { variants: nextVariants });
      } else {
        transaction.update(productRef, {
          base_stock: product.base_stock + item.qty,
        });
      }
    }
  });
}