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

  // Mode EDIT: jika productId dikirim, perbarui dokumen yang sama
  // (upsert) alih-alih selalu membuat dokumen baru.
  const productId =
    typeof body.productId === "string" && body.productId.trim() !== ""
      ? body.productId.trim()
      : null;

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
    const productRef = productId
      ? storeRef.collection("products").doc(productId)
      : storeRef.collection("products").doc();

    // Sanitasi data varian: pastikan setiap varian punya sku unik
    const sanitizedVariants = (product.variants || []).map((v, index) => ({
      sku: String(v.sku || `${product.name.replace(/\s/g, '').toUpperCase()}-${index + 1}`).trim(),
      name: String(v.name || `Varian ${index + 1}`).trim(),
      price: Math.max(0, Number(v.price) || 0),
      stock: v.unlimited_stock ? 0 : Math.max(0, Number(v.stock) || 0),
      unlimited_stock: Boolean(v.unlimited_stock),
      image_url: String(v.image_url || "").trim(),
    }));

    // Sanitasi gambar: filter yang kosong
    const sanitizedImages = (product.images || [])
      .filter(img => img && img.trim() !== "");

    const productData = {
      name: product.name.trim(),
      description: product.description || "",
      category: product.category || "",
      images: sanitizedImages.length > 0 ? sanitizedImages : [""],
      has_variants: product.has_variants ?? false,
      base_price: product.has_variants ? 0 : (Number(product.base_price) || 0),
      base_stock: product.has_variants ? 0 : (Number(product.base_stock) || 0),
      // Field pendukung yang sebelumnya hilang saat sanitasi — penting agar
      // data tersimpan bisa di-load kembali ke form editor tanpa berubah.
      selling_price: Math.max(0, Number(product.selling_price ?? product.base_price) || 0),
      base_cost: Math.max(0, Number(product.base_cost) || 0),
      unlimited_stock: Boolean(product.unlimited_stock),
      variants: sanitizedVariants,
      is_active: product.is_active !== false,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (productId) {
      await productRef.set(productData, { merge: true });
    } else {
      await productRef.set({
        ...productData,
        created_at: FieldValue.serverTimestamp(),
      });
    }

    // --- 2. Update custom_form_fields di dokumen store (jika ada fields baru) ---
    if (Array.isArray(fields) && fields.length > 0) {
      const storeSnap = await storeRef.get();

      const existingFields = storeSnap.exists
        ? (storeSnap.data().custom_form_fields || [])
        : [];

      const existingIds = new Set(existingFields.map((f) => f.field_id));

      // Hanya tambahkan field yang belum ada
      const newFields = fields.filter((f) => !existingIds.has(f.field_id));

      if (newFields.length > 0) {
        // PENTING: pakai set()+merge, BUKAN update(). Dokumen agregat
        // stores/{storeId} boleh saja belum ada (toko dibuat via dashboard
        // hanya membuat store_profiles/{id}, sementara produk hidup di
        // subkoleksi). update() melempar NOT_FOUND untuk dokumen kosong;
        // set+merge membuatnya otomatis.
        await storeRef.set(
          {
            custom_form_fields: FieldValue.arrayUnion(...newFields),
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        productId: productRef.id,
        updated: Boolean(productId),
        message: productId ? "Produk berhasil diperbarui" : "Produk berhasil disimpan",
      },
      { status: productId ? 200 : 201 }
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
