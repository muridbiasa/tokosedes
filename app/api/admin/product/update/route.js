import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

export async function PUT(request) {
  try {
    const { storeId, productId, product, fields } = await request.json();
    if (!storeId || !productId || !product?.name?.trim()) return NextResponse.json({ error: "storeId, productId, dan nama produk wajib diisi" }, { status: 400 });
    const variants = (product.variants || []).map((v, index) => ({ sku: String(v.sku || `${product.name}-${index + 1}`).trim(), name: String(v.name || `Varian ${index + 1}`).trim(), price: Math.max(0, Number(v.price) || 0), stock: v.unlimited_stock ? 0 : Math.max(0, Number(v.stock) || 0), unlimited_stock: Boolean(v.unlimited_stock), image_url: String(v.image_url || "").trim() }));
    const data = { name: product.name.trim(), description: product.description || "", category: product.category || "", images: (product.images || []).filter(Boolean), has_variants: Boolean(product.has_variants), base_price: product.has_variants ? 0 : Math.max(0, Number(product.base_price) || 0), base_stock: product.has_variants ? 0 : Math.max(0, Number(product.base_stock) || 0), variants, is_active: product.is_active !== false, updated_at: FieldValue.serverTimestamp() };
    await db.collection("stores").doc(storeId).collection("products").doc(productId).set(data, { merge: true });
    if (Array.isArray(fields)) await db.collection("store_profiles").doc(storeId).set({ custom_form_fields: fields, updated_at: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ success: true, productId });
  } catch (error) {
    console.error("[v0] product update failed", error);
    return NextResponse.json({ error: error.message || "Gagal memperbarui produk" }, { status: 500 });
  }
}
