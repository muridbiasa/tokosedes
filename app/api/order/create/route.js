/**
 * app/api/order/create/route.js
 *
 * POST /api/order/create
 *
 * Menerima pesanan dari storefront:
 * - Cek stok real-time via runTransaction
 * - Potong stok sementara (reserved)
 * - Panggil Midtrans Snap API
 * - Jika Midtrans gagal → rollback stok & status FAILED
 *
 * Sesuai PRD:
 * - Atomic stock update (runTransaction)
 * - Parsing notes -> custom_field_responses
 * - Pencocokan varian fleksibel (case-insensitive partial match)
 * - Gross_amount integer (Rupiah)
 * - Expiry format sesuai Midtrans: "YYYY-MM-DD HH:mm:ss +0700"
 */

import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";
import { snap } from "@/lib/midtrans";

export const maxDuration = 30;

function generateOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePart = `${y}${m}${d}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${datePart}-${suffix}`;
}

class OrderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Rollback stok jika Midtrans gagal atau order dibatalkan.
 */
async function releaseStockForOrder(orderData) {
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
        const newStock = (product.base_stock ?? product.stock ?? 0) + item.qty;
        transaction.update(productRef, {
          base_stock: newStock,
          stock: product.stock !== undefined ? newStock : undefined,
        });
      }
    }
  });
}

/**
 * Format tanggal untuk Midtrans expiry
 * Format: "2026-08-13 07:00:00 +0700"
 */
function formatMidtransDateTime(date) {
  const offset = 7 * 60; // WIB = UTC+7
  const localTime = new Date(date.getTime() + offset * 60000);
  const year = localTime.getFullYear();
  const month = String(localTime.getMonth() + 1).padStart(2, '0');
  const day = String(localTime.getDate()).padStart(2, '0');
  const hours = String(localTime.getHours()).padStart(2, '0');
  const minutes = String(localTime.getMinutes()).padStart(2, '0');
  const seconds = String(localTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body request bukan JSON yang valid" },
      { status: 400 }
    );
  }

  // Dukung format snake_case atau camelCase
  const store_id = body.store_id || body.storeId || "tokosedes-prod";
  // Nama boleh absen (admin mungkin tidak menambahkan field nama di form
  // dinamisnya) — fallback netral supaya checkout tetap bisa diproses.
  const customer_name = body.customer_name || body.customerName || "Pelanggan";
  const customer_phone = body.customer_phone || body.customerPhone;
  const customer_address = body.customer_address || body.customerAddress || "";
  const items = body.items || [];

  // Parsing custom field dari notes (string JSON)
  let custom_field_responses = body.custom_field_responses || {};
  if (Object.keys(custom_field_responses).length === 0 && body.notes) {
    try {
      custom_field_responses = JSON.parse(body.notes);
    } catch (e) {
      console.warn("[order/create] Gagal parsing body.notes:", e);
      custom_field_responses = { raw_notes: body.notes };
    }
  }

  // Validasi dasar
  if (!customer_name || !customer_phone || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Validasi gagal: Nama, No. WhatsApp, dan minimal 1 item produk wajib diisi." },
      { status: 400 }
    );
  }

  const storeRef = db.collection("stores").doc(store_id);

  try {
    // --- 1. Proses order dalam transaksi (cek stok & potong sementara) ---
    const orderData = await db.runTransaction(async (transaction) => {
      const productRefs = items.map((item) =>
        storeRef.collection("products").doc(item.product_id || item.id)
      );

      const productSnaps = await Promise.all(
        productRefs.map((ref) => transaction.get(ref))
      );

      const resolvedItems = [];
      let totalAmount = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const snapDoc = productSnaps[i];
        const productId = item.product_id || item.id;

        if (!snapDoc.exists) {
          throw new OrderError(
            `Produk "${item.name || productId}" tidak ditemukan di database.`,
            404
          );
        }

        const product = snapDoc.data();
        const itemQty = item.quantity || item.qty || 1;
        if (itemQty <= 0) {
          throw new OrderError(`Jumlah item tidak valid untuk produk "${item.name}"`, 400);
        }

        const frontendPrice = item.price || 0;

        if (product.has_variants && Array.isArray(product.variants)) {
          // --- Pencocokan varian fleksibel ---
          const variantIndex = product.variants.findIndex((v) => {
            if (item.sku && v.sku === item.sku) return true;
            if (item.name && v.name && item.name.toLowerCase().includes(v.name.toLowerCase())) {
              return true;
            }
            return false;
          });

          if (variantIndex === -1) {
            throw new OrderError(
              `Varian produk tidak ditemukan untuk item: ${item.name}`,
              404
            );
          }

          const variant = product.variants[variantIndex];
          if (frontendPrice && variant.price !== frontendPrice) {
            console.warn(
              `[order/create] Harga tidak sesuai: frontend ${frontendPrice}, db ${variant.price}`
            );
          }

          if (variant.stock < itemQty) {
            throw new OrderError(
              `Maaf, stok ${product.name} - ${variant.name} baru saja habis (tersisa ${variant.stock})`,
              409
            );
          }

          // Kurangi stok varian
          const nextVariants = [...product.variants];
          nextVariants[variantIndex] = {
            ...variant,
            stock: variant.stock - itemQty,
          };
          transaction.update(productRefs[i], { variants: nextVariants });

          resolvedItems.push({
            product_id: productId,
            sku: variant.sku || productId,
            name: `${product.name} - ${variant.name}`,
            qty: itemQty,
            price: variant.price,
            subtotal: variant.price * itemQty,
          });
          totalAmount += variant.price * itemQty;
        } else {
          // --- Produk tanpa varian ---
          const baseStock = product.base_stock ?? product.stock ?? 0;
          const basePrice = product.base_price ?? product.price ?? 0;

          if (frontendPrice && basePrice !== frontendPrice) {
            console.warn(
              `[order/create] Harga tidak sesuai: frontend ${frontendPrice}, db ${basePrice}`
            );
          }

          if (baseStock < itemQty) {
            throw new OrderError(
              `Maaf, stok ${product.name} baru saja habis (tersisa ${baseStock})`,
              409
            );
          }

          const newStock = baseStock - itemQty;
          transaction.update(productRefs[i], {
            base_stock: newStock,
            stock: product.stock !== undefined ? newStock : undefined,
          });

          resolvedItems.push({
            product_id: productId,
            sku: productId,
            name: product.name,
            qty: itemQty,
            price: basePrice,
            subtotal: basePrice * itemQty,
          });
          totalAmount += basePrice * itemQty;
        }
      }

      if (totalAmount <= 0) {
        throw new OrderError("Total harga tidak valid", 400);
      }

      const orderId = generateOrderId();
      const orderRef = db.collection("orders").doc();

      const newOrder = {
        order_id: orderId,
        storeId: store_id,
        store_id,
        customer_name,
        customer_phone,
        customer_address,
        custom_field_responses,
        items: resolvedItems,
        total_amount: totalAmount,
        payment_status: "PENDING",
        stock_status: "DEDUCTED",
        reserved_until: null,
        midtrans: {
          snap_token: null,
          transaction_id: null,
          payment_type: null,
          va_number: null,
        },
        synced_to_sheets: false,
        sheets_sync_error: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      transaction.set(orderRef, newOrder);
      return { docId: orderRef.id, ...newOrder };
    });

    // --- 2. Panggil Midtrans Snap API ---
    let snapResponse;
    try {
      // === PERBAIKAN: Format start_time sesuai Midtrans ===
      const formattedStart = formatMidtransDateTime(new Date());

      snapResponse = await snap.createTransaction({
        transaction_details: {
          order_id: orderData.order_id,
          gross_amount: orderData.total_amount,
        },
        customer_details: {
          first_name: customer_name,
          phone: customer_phone,
        },
        item_details: orderData.items.map((item) => ({
          id: item.sku,
          price: item.price,
          quantity: item.qty,
          name: item.name.slice(0, 50),
        })),
        expiry: {
          start_time: formattedStart,
          duration: 60,
          unit: "minute",
        },
      });
    } catch (midtransError) {
      console.error("[order/create] Midtrans error:", midtransError);
      // Rollback stok dan tandai order gagal
      await releaseStockForOrder(orderData);
      await db.collection("orders").doc(orderData.docId).update({
        payment_status: "FAILED",
        stock_status: "RELEASED",
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json(
        { error: "Gagal memproses pembayaran: " + midtransError.message },
        { status: 502 }
      );
    }

    // --- 3. Simpan snap_token ke Firestore ---
    await db
      .collection("orders")
      .doc(orderData.docId)
      .update({
        "midtrans.snap_token": snapResponse.token,
        updated_at: FieldValue.serverTimestamp(),
      });

    // --- 4. Response ---
    return NextResponse.json({
      order_id: orderData.order_id,
      total_amount: orderData.total_amount,
      snapToken: snapResponse.token,
      token: snapResponse.token,
      redirect_url: snapResponse.redirect_url,
    });

  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[order/create] Gagal membuat order:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pesanan: " + err.message },
      { status: 500 }
    );
  }
}