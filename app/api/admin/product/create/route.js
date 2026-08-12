/**
 * app/api/admin/product/create/route.js
 *
 * POST /api/admin/product/create
 *
 * Membuat produk baru di Firestore:
 * - Simpan ke stores/{storeId}/products/{productId}
 * - Update custom_form_fields di dokumen store (jika ada field baru)
 *
 * Body request:
 * {
 *   "storeId": "tokosedes-prod",
 *   "product": { name, description, category, images, has_variants,
 *                base_price, base_stock, variants },
 *   "fields": [ { field_id, label, type, options, is_required, order }, ... ]
 * }
 *
 * KEAMANAN: Belum ada verifikasi Auth. Tambahkan verifikasi token sebelum deploy.
 * Gunakan admin.auth().verifyIdToken(token) untuk proteksi.
 */

import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

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

  const { storeId, product, fields } = body;

  // Validasi dasar
  if (!storeId) {
    return NextResponse.json(
      { error: "storeId wajib diisi" },
      { status: 400 }
    );
  }

  if (!product || !product.name || product.name.trim() === "") {
    return NextResponse.json(
      { error: "product.name wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const storeRef = db.collection("stores").doc(storeId);

    // --- 1. Simpan produk ke subkoleksi products ---
    const productRef = storeRef.collection("products").doc();

    const productData = {
      name: product.name.trim(),
      description: product.description || "",
      category: product.category || "",
      images: Array.isArray(product.images) ? product.images : [""],
      has_variants: product.has_variants ?? false,
      base_price: product.has_variants ? 0 : (Number(product.base_price) || 0),
      base_stock: product.has_variants ? 0 : (Number(product.base_stock) || 0),
      variants: Array.isArray(product.variants) ? product.variants : [],
      is_active: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await productRef.set(productData);

    // --- 2. Update custom_form_fields di dokumen store (jika ada fields baru) ---
    if (Array.isArray(fields) && fields.length > 0) {
      const storeSnap = await storeRef.get();

      // Ambil custom_form_fields yang sudah ada
      const existingFields = storeSnap.exists
        ? (storeSnap.data().custom_form_fields || [])
        : [];

      const existingIds = new Set(existingFields.map((f) => f.field_id));

      // Hanya tambahkan field yang belum ada (berdasarkan field_id)
      const newFields = fields.filter((f) => !existingIds.has(f.field_id));

      if (newFields.length > 0) {
        await storeRef.update({
          custom_form_fields: FieldValue.arrayUnion(...newFields),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    }

    // --- 3. Response sukses ---
    return NextResponse.json(
      {
        success: true,
        productId: productRef.id,
        message: "Produk berhasil disimpan",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/product/create] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan produk: " + error.message,
      },
      { status: 500 }
    );
  }
}