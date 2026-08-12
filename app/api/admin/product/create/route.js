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

import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

export const maxDuration = 30;

function validateProduct(product) {
  const errors = [];
  if (!product?.name || typeof product.name !== "string" || !product.name.trim()) {
    errors.push("Nama produk wajib diisi");
  }
  if (product?.has_variants) {
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      errors.push("Produk dengan varian wajib punya minimal 1 varian");
    } else {
      product.variants.forEach((v, i) => {
        if (!v.sku) errors.push(`variants[${i}].sku wajib diisi`);
        if (!v.name) errors.push(`variants[${i}].name wajib diisi`);
      });
    }
  } else {
    if (product?.base_price == null || product.base_price < 0) {
      errors.push("base_price wajib diisi dan tidak boleh negatif");
    }
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

  const storeId = body.storeId || body.store_id;
  const product = body.product;
  const fields = Array.isArray(body.fields) ? body.fields : [];

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }
  if (!product) {
    return NextResponse.json({ error: "product wajib diisi" }, { status: 400 });
  }

  const validationErrors = validateProduct(product);
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Validasi gagal", details: validationErrors },
      { status: 400 }
    );
  }

  try {
    const storeRef = db.collection("stores").doc(storeId);
    const storeSnap = await storeRef.get();

    if (!storeSnap.exists) {
      return NextResponse.json(
        { error: `Toko dengan storeId "${storeId}" tidak ditemukan. Buat dulu dokumennya di Firestore (collection "stores").` },
        { status: 404 }
      );
    }

    const productRef = storeRef.collection("products").doc();

    const productData = {
      product_id: productRef.id,
      name: product.name.trim(),
      description: product.description || "",
      category: product.category || "",
      images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
      has_variants: !!product.has_variants,
      base_price: product.has_variants ? 0 : Number(product.base_price) || 0,
      base_stock: product.has_variants ? 0 : Number(product.base_stock) || 0,
      variants: product.has_variants
        ? (product.variants || []).map((v) => ({
            sku: v.sku,
            name: v.name,
            price: Number(v.price) || 0,
            stock: Number(v.stock) || 0,
            image_url: v.image_url || "",
          }))
        : [],
      is_active: true,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await productRef.set(productData);

    // custom_form_fields disimpan di level toko (bukan per-produk), sesuai
    // skema Modul 1 §1.1 — jadi field form berlaku untuk semua produk toko.
    if (fields.length > 0) {
      await storeRef.update({
        custom_form_fields: fields,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      product_id: productRef.id,
      message: "Produk berhasil disimpan",
    });
  } catch (err) {
    console.error("[admin/product/create] Gagal menyimpan produk:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menyimpan produk: " + err.message },
      { status: 500 }
    );
  }
}
