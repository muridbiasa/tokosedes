import { NextResponse } from "next/server";
import admin, { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_ID = "tokosedes-central";
const BRANCH_ID = "tokosedes-cabang";
const seedKey = () => process.env.FIREBASE_SEED_KEY || "sedes2026";

function timestamp(date = new Date()) {
  return admin.firestore.Timestamp.fromDate(date);
}

function dateAt(daysAgo, hour, minute) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function orderItems(items) {
  return items.map((item) => ({
    productId: item.productId,
    variantName: item.variantName || null,
    quantity: item.quantity,
    price: item.price,
    baseCost: item.baseCost,
    subtotal: item.quantity * item.price,
  }));
}

export async function GET(request) {
  const providedKey = new URL(request.url).searchParams.get("key");

  if (!providedKey || providedKey !== seedKey()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const centralRef = db.collection("stores").doc(STORE_ID);
    const branchRef = db.collection("stores").doc(BRANCH_ID);
    const profileCentralRef = db.collection("store_profiles").doc(STORE_ID);
    const profileBranchRef = db.collection("store_profiles").doc(BRANCH_ID);
    const activeStoreRef = db.collection("settings").doc("active_store");

    const cookiesFields = [
      { id: "buyer_name", label: "Nama", type: "short_text", required: true },
      { id: "buyer_phone", label: "Nomor WhatsApp", type: "phone", required: true },
      { id: "notes", label: "Catatan Pesanan", type: "long_text", required: false },
    ];

    const centralProfile = {
      name: "Toko Sedes Central",
      isActive: true,
      enabled: true,
      created_at: timestamp(now),
      updated_at: timestamp(now),
      settings: {
        storeName: "Toko Sedes Central",
        description: "Cemilan artisan dan minuman favorit untuk setiap momen.",
        themeColor: "#F2A93B",
        fontFamily: "Poppins",
        headerMode: "image",
        headerValue: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1600&q=85",
        isStoreOpen: true,
        closedMessage: "Pesanan sedang ditutup. Silakan kembali lagi nanti.",
        catalogGridSize: "medium",
        custom_form_fields: cookiesFields,
      },
    };

    const branchProfile = {
      name: "Toko Sedes Cabang",
      isActive: false,
      enabled: false,
      created_at: timestamp(now),
      updated_at: timestamp(now),
      settings: {
        storeName: "Toko Sedes Cabang",
        description: "Cabang Toko Sedes.",
        themeColor: "#6B7280",
        fontFamily: "sans-serif",
        headerMode: "solid",
        headerValue: "#6B7280",
        isStoreOpen: false,
        closedMessage: "Cabang sedang tutup untuk sementara waktu.",
        catalogGridSize: "medium",
        custom_form_fields: cookiesFields,
      },
    };

    const centralStore = {
      store_id: STORE_ID,
      profile_id: STORE_ID,
      name: "Toko Sedes Central",
      enabled: true,
      isActive: true,
      isStoreOpen: true,
      created_at: timestamp(now),
      updated_at: timestamp(now),
    };

    const branchStore = {
      store_id: BRANCH_ID,
      profile_id: BRANCH_ID,
      name: "Toko Sedes Cabang",
      enabled: false,
      isActive: false,
      isStoreOpen: false,
      closedMessage: "Cabang sedang tutup untuk sementara waktu.",
      created_at: timestamp(now),
      updated_at: timestamp(now),
    };

    const products = [
      {
        id: "soft-cookies-box",
        data: {
          product_id: "soft-cookies-box",
          store_id: STORE_ID,
          name: "Soft Cookies Box",
          description: "Kotak soft cookies dengan tekstur chewy dan topping melimpah.",
          category: "Cookies",
          sellingPrice: 25000,
          selling_price: 25000,
          baseCost: 12000,
          base_cost: 12000,
          hpp: 12000,
          stock: 15,
          base_stock: 15,
          isUnlimitedStock: false,
          isActive: true,
          active: true,
          status: "active",
          has_variants: false,
          variants: [],
          images: ["https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1000&q=85"],
          imageUrl: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1000&q=85",
          created_at: timestamp(now),
          updated_at: timestamp(now),
        },
      },
      {
        id: "artisan-milk-tea",
        data: {
          product_id: "artisan-milk-tea",
          store_id: STORE_ID,
          name: "Artisan Milk Tea",
          description: "Milk tea creamy dengan pilihan rasa artisan.",
          category: "Minuman",
          sellingPrice: 18000,
          selling_price: 18000,
          baseCost: 8000,
          base_cost: 8000,
          hpp: 8000,
          stock: 0,
          base_stock: 0,
          isUnlimitedStock: true,
          isActive: true,
          active: true,
          status: "active",
          has_variants: true,
          variants: [
            { sku: "AMT-MATCHA", name: "Matcha", variantName: "Matcha", price: 18000, baseCost: 8000, stock: 0, isUnlimitedStock: true, imageUrl: "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=1000&q=85" },
            { sku: "AMT-RED-VELVET", name: "Red Velvet", variantName: "Red Velvet", price: 18000, baseCost: 8000, stock: 0, isUnlimitedStock: true, imageUrl: "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1000&q=85" },
            { sku: "AMT-CLASSIC-CHOCO", name: "Classic Choco", variantName: "Classic Choco", price: 18000, baseCost: 8000, stock: 0, isUnlimitedStock: true, imageUrl: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=1000&q=85" },
          ],
          images: ["https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=1000&q=85"],
          imageUrl: "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=1000&q=85",
          created_at: timestamp(now),
          updated_at: timestamp(now),
        },
      },
    ];

    const orderDefinitions = [
      ["seed-order-001", 0, 10, "PAID", "Sari", [{ productId: "soft-cookies-box", quantity: 2, price: 25000, baseCost: 12000 }]],
      ["seed-order-002", 0, 13, "PAID", "Bima", [{ productId: "artisan-milk-tea", variantName: "Matcha", quantity: 2, price: 18000, baseCost: 8000 }]],
      ["seed-order-003", 0, 18, "PENDING", "Nadia", [{ productId: "soft-cookies-box", quantity: 1, price: 25000, baseCost: 12000 }, { productId: "artisan-milk-tea", variantName: "Classic Choco", quantity: 1, price: 18000, baseCost: 8000 }]],
      ["seed-order-004", 1, 9, "PAID", "Raka", [{ productId: "artisan-milk-tea", variantName: "Red Velvet", quantity: 3, price: 18000, baseCost: 8000 }]],
      ["seed-order-005", 1, 15, "EXPIRED", "Maya", [{ productId: "soft-cookies-box", quantity: 2, price: 25000, baseCost: 12000 }]],
      ["seed-order-006", 1, 20, "PAID", "Dito", [{ productId: "soft-cookies-box", quantity: 1, price: 25000, baseCost: 12000 }, { productId: "artisan-milk-tea", variantName: "Matcha", quantity: 2, price: 18000, baseCost: 8000 }]],
    ];

    const batch = db.batch();
    batch.set(profileCentralRef, centralProfile, { merge: true });
    batch.set(profileBranchRef, branchProfile, { merge: true });
    batch.set(centralRef, centralStore, { merge: true });
    batch.set(branchRef, branchStore, { merge: true });
    batch.set(activeStoreRef, { storeId: STORE_ID, updated_at: timestamp(now) }, { merge: true });

    for (const product of products) {
      batch.set(centralRef.collection("products").doc(product.id), product.data, { merge: true });
    }

    const createdOrderIds = [];
    for (const [id, daysAgo, hour, status, customerName, rawItems] of orderDefinitions) {
      const items = orderItems(rawItems);
      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      const createdAt = dateAt(daysAgo, hour, 0);
      const orderRef = db.collection("orders").doc(id);
      batch.set(orderRef, {
        order_id: id,
        store_id: STORE_ID,
        storeId: STORE_ID,
        customer_name: customerName,
        customer_phone: `08123456${String(orderDefinitions.indexOf(orderDefinitions.find((entry) => entry[0] === id)) + 1).padStart(2, "0")}`,
        customer_address: "Jakarta",
        items,
        total_amount: total,
        payment_status: status,
        stock_status: status === "EXPIRED" ? "RELEASED" : "DEDUCTED",
        custom_field_responses: { notes: "Data contoh untuk analytics" },
        midtrans: { snap_token: null, transaction_id: null, payment_type: null },
        synced_to_sheets: false,
        created_at: timestamp(createdAt),
        updated_at: timestamp(createdAt),
      }, { merge: true });
      createdOrderIds.push(id);
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: "Seed data TokoSedes berhasil dibuat.",
      ids: {
        stores: [STORE_ID, BRANCH_ID],
        profiles: [STORE_ID, BRANCH_ID],
        products: products.map((product) => product.id),
        orders: createdOrderIds,
      },
    });
  } catch (error) {
    console.error("[seed] Firestore seed failed", error);
    return NextResponse.json({ error: "Seed gagal diproses." }, { status: 500 });
  }
}
