/**
 * app/api/admin/store/delete/route.js
 *
 * POST /api/admin/store/delete
 * Body: { "storeId": "..." }
 *
 * Menghapus toko secara menyeluruh:
 * - seluruh dokumen stores/{storeId}/products/*
 * - dokumen agregat stores/{storeId}
 * - profil toko store_profiles/{storeId}
 *
 * Pesanan lama (collection `orders`) SENGAJA dipertahankan sebagai arsip.
 * Jika toko yang dihapus sedang aktif, pointer settings/active_store
 * otomatis dipindah ke toko tersisa (pertama yang enabled, atau apa pun).
 */

import { NextResponse } from "next/server";
import { db, FieldValue } from "@/lib/firebase-admin";

export const maxDuration = 30;

const BATCH_LIMIT = 400; // batas aman operasi per batch Firestore

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body bukan JSON valid" }, { status: 400 });
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!storeId) {
    return NextResponse.json({ error: "storeId wajib diisi" }, { status: 400 });
  }

  try {
    const storeRef = db.collection("stores").doc(storeId);
    const profileRef = db.collection("store_profiles").doc(storeId);

    // --- 1. Hapus semua produk dalam batch ---
    const productsSnap = await storeRef.collection("products").get();
    const refs = [];
    productsSnap.forEach((doc) => refs.push(doc.ref));

    let deletedProducts = 0;
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + BATCH_LIMIT)) batch.delete(ref);
      await batch.commit();
      deletedProducts += Math.min(BATCH_LIMIT, refs.length - i);
    }

    // --- 2. Hapus dokumen toko & profil (no-op aman bila tidak ada) ---
    await storeRef.delete();
    await profileRef.delete();

    // --- 3. Pindahkan pointer toko aktif bila yang dihapus sedang aktif ---
    let newActiveId = null;
    const activeSnap = await db.collection("settings").doc("active_store").get();
    if (activeSnap.exists && activeSnap.data().storeId === storeId) {
      let remaining = await db
        .collection("store_profiles")
        .where("enabled", "==", true)
        .limit(1)
        .get();
      if (remaining.empty) {
        remaining = await db.collection("store_profiles").limit(1).get();
      }
      if (!remaining.empty) {
        newActiveId = remaining.docs[0].id;
        await db
          .collection("settings")
          .doc("active_store")
          .set(
            { storeId: newActiveId, updated_at: FieldValue.serverTimestamp() },
            { merge: true }
          );
      } else {
        await db.collection("settings").doc("active_store").delete();
      }
    }

    return NextResponse.json({
      success: true,
      storeId,
      deletedProducts,
      newActiveId,
      message: `Toko "${storeId}" beserta ${deletedProducts} produk telah dihapus.`,
    });
  } catch (error) {
    console.error("[admin/store/delete] Error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus toko: " + error.message },
      { status: 500 }
    );
  }
}
