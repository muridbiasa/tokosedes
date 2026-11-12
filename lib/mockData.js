/**
 * lib/mockData.js
 *
 * Data contoh (dummy) — dipakai sementara di storefront (app/page.js) dan
 * dashboard (app/admin/dashboard/page.js) supaya tampilan bisa dilihat
 * tanpa Firebase aktif. Bentuk datanya SAMA PERSIS dengan skema Firestore
 * Modul 1, jadi tinggal diganti sumbernya ke Firestore query nanti.
 */

export const mockStore = {
  store_id: "store_demo",
  store_name: "Toko Budi",
  store_slug: "toko-budi",
  description: "Kaos & merch custom, produksi mingguan.",
  is_active: true,
};

export const mockCustomFields = [
  {
    field_id: "f_tulisan_custom",
    label: "Tulisan custom di produk (opsional)",
    type: "text",
    options: [],
    is_required: false,
    order: 0,
  },
  {
    field_id: "f_pengiriman",
    label: "Metode pengiriman",
    type: "radio",
    options: ["Ambil di tempat", "Kirim (ongkir menyusul)"],
    is_required: true,
    order: 1,
  },
];

export const mockProducts = [
  {
    product_id: "prod_001",
    name: "Kaos Polos Cotton Combed",
    description: "Bahan combed 30s, adem dan tidak mudah melar.",
    category: "Barang",
    images: [
      "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0jK/view",
      "https://drive.google.com/file/d/2B3c4D5e6F7g8H9i0J1k/view",
    ],
    has_variants: true,
    base_price: 0,
    base_stock: 0,
    variants: [
      { sku: "KP-S", name: "S", price: 50000, stock: 10, image_url: "" },
      { sku: "KP-M", name: "M", price: 50000, stock: 3, image_url: "" },
      { sku: "KP-L", name: "L", price: 55000, stock: 0, image_url: "" },
      { sku: "KP-XL", name: "XL", price: 58000, stock: 6, image_url: "" },
    ],
    is_active: true,
  },
  {
    product_id: "prod_002",
    name: "Tote Bag Kanvas",
    description: "Kanvas tebal 12oz, cocok untuk sablon custom.",
    category: "Barang",
    images: ["https://drive.google.com/file/d/3C4d5E6f7G8h9I0j1K2l/view"],
    has_variants: false,
    base_price: 35000,
    base_stock: 20,
    variants: [],
    is_active: true,
  },
  {
    product_id: "prod_003",
    name: "Nasi Box Ayam Geprek",
    description: "Include nasi, ayam geprek, lalapan, sambal.",
    category: "Makanan",
    images: [],
    has_variants: true,
    base_price: 0,
    base_stock: 0,
    variants: [
      { sku: "NB-PEDAS", name: "Level Pedas", price: 22000, stock: 15, image_url: "" },
      { sku: "NB-NOPEDAS", name: "Tidak Pedas", price: 22000, stock: 15, image_url: "" },
    ],
    is_active: true,
  },
];

export const mockOrders = [
  {
    order_id: "ORD-20260806-014",
    customer_name: "Budi Santoso",
    customer_phone: "081234567890",
    items: [{ sku: "KP-M", name: "Kaos Polos Cotton Combed - M", qty: 2, price: 50000 }],
    total_amount: 100000,
    payment_status: "PAID",
    synced_to_sheets: true,
    created_at: "2026-08-06T10:15:00Z",
  },
  {
    order_id: "ORD-20260807-021",
    customer_name: "Sri Wulandari",
    customer_phone: "081298765432",
    items: [{ sku: "TB-01", name: "Tote Bag Kanvas", qty: 3, price: 35000 }],
    total_amount: 105000,
    payment_status: "PENDING",
    synced_to_sheets: false,
    created_at: "2026-08-07T14:40:00Z",
  },
  {
    order_id: "ORD-20260807-022",
    customer_name: "Andi Firmansyah",
    customer_phone: "081311223344",
    items: [{ sku: "NB-PEDAS", name: "Nasi Box Ayam Geprek - Pedas", qty: 5, price: 22000 }],
    total_amount: 110000,
    payment_status: "EXPIRED",
    synced_to_sheets: false,
    created_at: "2026-08-05T09:05:00Z",
  },
  {
    order_id: "ORD-20260808-003",
    customer_name: "Melati Putri",
    customer_phone: "081455667788",
    items: [{ sku: "KP-XL", name: "Kaos Polos Cotton Combed - XL", qty: 1, price: 58000 }],
    total_amount: 58000,
    payment_status: "PAID",
    synced_to_sheets: true,
    created_at: "2026-08-08T08:20:00Z",
  },
];

export const mockAnalyticsSummary = {
  total_revenue: mockOrders
    .filter((o) => o.payment_status === "PAID")
    .reduce((sum, o) => sum + o.total_amount, 0),
  total_transactions: mockOrders.filter((o) => o.payment_status === "PAID").length,
  product_sales: [
    { name: "Kaos Polos Cotton Combed - M", qty: 2 },
    { name: "Kaos Polos Cotton Combed - XL", qty: 1 },
    { name: "Nasi Box Ayam Geprek - Pedas", qty: 5 },
  ],
};
