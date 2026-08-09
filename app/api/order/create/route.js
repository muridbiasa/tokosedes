    /**
     * app/api/order/create/route.js
     *
     * POST /api/order/create
     *
     * Menerima pesanan dari storefront, MELAKUKAN PENGECEKAN STOK REAL-TIME
     * via Firestore runTransaction (PRD §5.1 & §4 Do's: "Atomic Stock Update"),
     * membuat dokumen order berstatus PENDING, lalu memanggil Midtrans Snap API
     * Production untuk menerbitkan token pembayaran.
     *
     * PENTING (Modul 1 Security Rules): endpoint inilah satu-satunya jalur sah
     * untuk membuat dokumen `orders` — client TIDAK PUNYA izin `create` langsung
     * ke Firestore untuk collection ini. Endpoint ini memakai Firebase Admin
     * SDK (lib/firebase-admin.js) yang otomatis bypass Security Rules, karena
     * validasi keamanannya dilakukan di sini, bukan lewat Rules.
     *
     * Body request yang diharapkan:
     * {
     *   "store_id": "store_demo",
     *   "customer_name": "Budi Santoso",
     *   "customer_phone": "081234567890",
     *   "custom_field_responses": { "f_pengiriman": "Ambil di tempat" },
     *   "items": [
     *     { "product_id": "prod_001", "sku": "KP-M", "name": "Kaos Polos - M", "qty": 2, "price": 50000 }
     *   ]
     * }
     */

    import { NextResponse } from "next/server";
    import { db, FieldValue } from "@/lib/firebase-admin";
    import { snap } from "@/lib/midtrans";

    export const maxDuration = 30; // detik — lihat catatan vercel.json

    function generateOrderId() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        const datePart = `${y}${m}${d}`;
        // Suffix acak 4 digit — cukup untuk menghindari collision dalam 1 hari
        // pada skala UMKM; bukan penjamin keunikan mutlak, tapi dikombinasikan
        // dengan Firestore auto-generated doc ID di bawah untuk keamanan ekstra.
        const suffix = Math.floor(1000 + Math.random() * 9000);
        return `ORD-${datePart}-${suffix}`;
    }

    function validateBody(body) {
        const errors = [];

        if (!body?.store_id || typeof body.store_id !== "string") {
            errors.push("store_id wajib diisi");
        }
        if (!body?.customer_name || typeof body.customer_name !== "string") {
            errors.push("customer_name wajib diisi");
        }
        if (!body?.customer_phone || typeof body.customer_phone !== "string") {
            errors.push("customer_phone wajib diisi");
        }
        if (!Array.isArray(body?.items) || body.items.length === 0) {
            errors.push("items wajib berisi minimal 1 produk");
        } else {
            body.items.forEach((item, i) => {
                if (!item.product_id) errors.push(`items[${i}].product_id wajib diisi`);
                if (!item.sku) errors.push(`items[${i}].sku wajib diisi`);
                if (!item.qty || item.qty <= 0) errors.push(`items[${i}].qty harus lebih dari 0`);
            });
        }

        return errors;
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

        const validationErrors = validateBody(body);
        if (validationErrors.length > 0) {
            return NextResponse.json(
                { error: "Validasi gagal", details: validationErrors },
                { status: 400 }
            );
        }

        const {
            store_id,
            customer_name,
            customer_phone,
            customer_address = "",
            custom_field_responses = {},
            items,
        } = body;

        const storeRef = db.collection("stores").doc(store_id);

        try {
            // --- TRANSAKSI ATOMIK: cek stok & kunci stok dalam satu operasi ---
            // Mencegah race condition dua pembeli checkout stok terakhir bersamaan
            // (PRD §5.1). Firestore runTransaction menjamin baca-lalu-tulis ini
            // atomik: kalau ada operasi lain menyentuh dokumen yang sama di antara
            // read dan write, transaksi otomatis di-retry oleh SDK.
            const orderData = await db.runTransaction(async (transaction) => {
                const productRefs = items.map((item) =>
                    storeRef.collection("products").doc(item.product_id)
                );

                // Semua read WAJIB dilakukan sebelum write manapun dalam transaction.
                const productSnaps = await Promise.all(
                    productRefs.map((ref) => transaction.get(ref))
                );

                const resolvedItems = [];
                let totalAmount = 0;

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const snap = productSnaps[i];

                    if (!snap.exists) {
                        throw new OrderError(
                            `Produk "${item.name || item.product_id}" tidak ditemukan.`,
                            404
                        );
                    }

                    const product = snap.data();

                    if (product.has_variants) {
                        const variantIndex = (product.variants || []).findIndex(
                            (v) => v.sku === item.sku
                        );
                        if (variantIndex === -1) {
                            throw new OrderError(
                                `Varian "${item.sku}" untuk produk "${product.name}" tidak ditemukan.`,
                                404
                            );
                        }

                        const variant = product.variants[variantIndex];

                        if (variant.stock < item.qty) {
                            // Pesan sesuai PRD §5.1 persis.
                            throw new OrderError(
                                `Maaf, stok ${product.name} - ${variant.name} baru saja habis`,
                                409
                            );
                        }

                        const nextVariants = [...product.variants];
                        nextVariants[variantIndex] = {
                            ...variant,
                            stock: variant.stock - item.qty,
                        };
                        transaction.update(productRefs[i], { variants: nextVariants });

                        resolvedItems.push({
                            product_id: item.product_id,
                            sku: variant.sku,
                            name: `${product.name} - ${variant.name}`,
                            qty: item.qty,
                            price: variant.price,
                            subtotal: variant.price * item.qty,
                        });
                        totalAmount += variant.price * item.qty;
                    } else {
                        if (product.base_stock < item.qty) {
                            throw new OrderError(
                                `Maaf, stok ${product.name} baru saja habis`,
                                409
                            );
                        }

                        transaction.update(productRefs[i], {
                            base_stock: product.base_stock - item.qty,
                        });

                        resolvedItems.push({
                            product_id: item.product_id,
                            sku: item.product_id,
                            name: product.name,
                            qty: item.qty,
                            price: product.base_price,
                            subtotal: product.base_price * item.qty,
                        });
                        totalAmount += product.base_price * item.qty;
                    }
                }

                const orderId = generateOrderId();
                const orderRef = storeRef.collection("orders").doc();

                const newOrder = {
                    order_id: orderId,
                    store_id,
                    customer_name,
                    customer_phone,
                    customer_address,
                    custom_field_responses,
                    items: resolvedItems,
                    total_amount: totalAmount,
                    payment_status: "PENDING",
                    stock_status: "DEDUCTED", // stok sudah dipotong langsung; lihat catatan di bawah
                    reserved_until: null,
                    midtrans: {
                        snap_token: null,
                        transaction_id: null,
                        payment_type: null,
                        va_number: null,
                        transaction_time: null,
                        settlement_time: null,
                    },
                    synced_to_sheets: false,
                    sheets_sync_error: null,
                    created_at: FieldValue.serverTimestamp(),
                    updated_at: FieldValue.serverTimestamp(),
                };

                transaction.set(orderRef, newOrder);

                return { docId: orderRef.id, ...newOrder };
            });

            // --- Panggil Midtrans Snap API Production ---
            const snapResponse = await snap.createTransaction({
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
                    name: item.name.slice(0, 50), // Midtrans membatasi max 50 char per item name
                })),
                callbacks: {
                    finish: `${getBaseUrl(request)}/order/${orderData.order_id}/status`,
                },
            });

            // Simpan snap_token ke dokumen order supaya bisa dilacak/di-retry
            // kalau pembeli menutup popup tanpa membayar.
            await storeRef
                .collection("orders")
                .doc(orderData.docId)
                .update({
                    "midtrans.snap_token": snapResponse.token,
                    updated_at: FieldValue.serverTimestamp(),
                });

            return NextResponse.json({
                order_id: orderData.order_id,
                total_amount: orderData.total_amount,
                token: snapResponse.token,
                redirect_url: snapResponse.redirect_url,
            });
        } catch (err) {
            if (err instanceof OrderError) {
                return NextResponse.json({ error: err.message }, { status: err.status });
            }

            console.error("[order/create] Gagal membuat order:", err);
            return NextResponse.json(
                { error: "Terjadi kesalahan saat memproses pesanan. Coba lagi." },
                { status: 500 }
            );
        }
    }

    /** Error terkontrol (stok habis, produk tidak ada) — beda dari error tak terduga. */
    class OrderError extends Error {
        constructor(message, status) {
            super(message);
            this.status = status;
        }
    }

    function getBaseUrl(request) {
        // Vercel menyediakan header ini otomatis; fallback ke env var eksplisit
        // untuk custom domain (lihat daftar env var).
        if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
        const host = request.headers.get("host");
        const protocol = host?.startsWith("localhost") ? "http" : "https";
        return `${protocol}://${host}`;
    }