/**
 * app/api/admin/product/list/route.js
 *
 * GET /api/admin/product/list?storeId=xxx
 *
 * Memuat daftar produk toko via Admin SDK (bypass Security Rules).
 * Dipakai halaman editor agar produk tersimpan SELALU bisa dimuat,
 * terlepas dari aturan read client pada subkoleksi stores/{id}/products.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const storeId = new URL(request.url).searchParams.get("storeId");

  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  try {
    const snap = await db
      .collection("stores")
      .doc(storeId)
      .collection("products")
      .get();

    const products = snap.docs.map((doc) => ({
      productId: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      storeId,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("[admin/product/list] Error:", error);
    return NextResponse.json(
      { error: "Gagal memuat daftar produk: " + error.message },
      { status: 500 }
    );
  }
}
