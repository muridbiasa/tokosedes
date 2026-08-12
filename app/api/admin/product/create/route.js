/**
 * app/api/admin/product/create/route.js
 *
 * POST /api/admin/product/create
 *
 * Dipanggil oleh app/admin/produk/baru/page.js saat Admin klik
 * "Simpan & Publikasikan" di <FormBuilder />. Menulis dokumen produk baru
 * ke Firestore: stores/{storeId}/products/{productId}, dan (jika ada field
 * form kustom baru) memperbarui stores/{storeId}.custom_form_fields.
 *
 * CATATAN KEAMANAN — INI BELUM PRODUCTION-READY:
 * Endpoint ini saat ini TIDAK memverifikasi siapa pemanggilnya. Menurut
 * Security Rules Modul 1, hanya owner/staff toko (isStoreOwner /
 * isStoreStaff) yang boleh menulis ke `products`. Karena route ini memakai
 * Firebase Admin SDK (bypass Security Rules) dan belum ada pengecekan
 * sesi/token Admin di sini, SIAPA PUN yang tahu URL endpoint ini bisa
 * menambah produk ke toko manapun. Sebelum go-live, endpoint ini WAJIB
 * ditambah verifikasi identitas Admin (mis. Firebase Auth ID token di
 * header Authorization, dicek dengan admin.auth().verifyIdToken()).
 *
 * Body request yang diharapkan (sesuai page.js form tambah produk):
 * {
 *   "storeId": "tokosedes-prod",
 *   "product": { name, description, category, images, has_variants,
 *                base_price, base_stock, variants },
 *   "fields": [ { field_id, label, type, options, is_required, order }, ... ]
 * }
 */

/**
 * app/api/order/create/route.js
 *
 * POST /api/order/create
 *
 * Menerima pesanan dari storefront, MELAKUKAN PENGECEKAN STOK REAL-TIME
 * via Firestore runTransaction, membuat dokumen order berstatus PENDING,
 * lalu memanggil Midtrans Snap API untuk menerbitkan token pembayaran.
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

    // Mendukung properti format snake_case atau camelCase dari frontend
    const store_id = body.store_id || body.storeId || "tokosedes-prod";
    const customer_name = body.customer_name || body.customerName;
    const customer_phone = body.customer_phone || body.customerPhone;
    const customer_address = body.customer_address || body.customerAddress || "";
    const items = body.items || [];
    
    // PERBAIKAN 1: Menangani data custom field yang dikirim sebagai string JSON di dalam "notes"
    let custom_field_responses = body.custom_field_responses || {};
    if (Object.keys(custom_field_responses).length === 0 && body.notes) {
        try {
            custom_field_responses = JSON.parse(body.notes);
        } catch (e) {
            console.warn("[order/create] Gagal parsing body.notes:", e);
        }
    }

    // Validasi dasar
    if (!customer_name || !customer_phone || items.length === 0) {
        return NextResponse.json(
            { error: "Validasi gagal: Nama, No. WhatsApp, dan minimal 1 item produk wajib diisi." },
            { status: 400 }
        );
    }

    const storeRef = db.collection("stores").doc(store_id);

    try {
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

                if (product.has_variants && product.variants) {
                    // PERBAIKAN 2: Logika pencarian varian yang lebih pintar (Fallback ke pencocokan nama)
                    const variantIndex = product.variants.findIndex((v) => {
                        // Cek 1: Jika frontend mengirim sku, cocokkan dengan sku
                        if (item.sku && v.sku === item.sku) return true;
                        
                        // Cek 2: Cek apakah nama dari frontend (misal "cookies - redvelvet") mengandung nama varian ("redvelvet")
                        if (item.name && v.name && item.name.toLowerCase().includes(v.name.toLowerCase())) return true;
                        
                        return false;
                    });

                    if (variantIndex === -1) {
                        throw new OrderError(
                            `Varian produk tidak ditemukan. Pastikan data produk di database sesuai dengan yang dikirim.`,
                            404
                        );
                    }

                    const variant = product.variants[variantIndex];
                    if (variant.stock < itemQty) {
                        throw new OrderError(
                            `Maaf, stok ${product.name} - ${variant.name} baru saja habis`,
                            409
                        );
                    }

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
                    const baseStock = product.base_stock ?? product.stock ?? 0;
                    const basePrice = product.base_price ?? product.price ?? 0;

                    if (baseStock < itemQty) {
                        throw new OrderError(
                            `Maaf, stok ${product.name} baru saja habis`,
                            409
                        );
                    }

                    transaction.update(productRefs[i], {
                        base_stock: baseStock - itemQty,
                        stock: (product.stock !== undefined) ? product.stock - itemQty : undefined
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

        // --- Panggil Midtrans Snap API ---
        const snapResponse = await snap.createTransaction({
            transaction_details: {
                order_id: orderData.order_id,
                // Pastikan gross_amount di database minimal bernilai ribuan (misal 13000, bukan 13)
                // agar tidak ditolak oleh Midtrans
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
        });

        await db
            .collection("orders")
            .doc(orderData.docId)
            .update({
                "midtrans.snap_token": snapResponse.token,
                updated_at: FieldValue.serverTimestamp(),
            });

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

class OrderError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}