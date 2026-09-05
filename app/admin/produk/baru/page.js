"use client";

import { useState, useMemo, useEffect } from "react";
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import {
  Minus,
  Plus,
  ShoppingCart,
  X,
  Check,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Store,
  ChevronLeft,
} from "lucide-react";
import DriveImage from "@/components/shared/DriveImage";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { getGridClasses, isUnlimitedStock, stockAllows, isValidPhone } from "@/lib/storeProfiles";
import ProductDetailModal from "@/components/ProductDetailModal";
// UI super ringan: shadcn/ui (lokal) + auto-animate (~2KB)
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

/**
 * app/page.js
 *
 * Storefront Pembeli / Editor Katalog — UI by Claude, Backend Logic by Production System.
 */

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

// Kunci unik item keranjang: gabungan product_id + sku (atau "base" kalau tanpa varian)
function cartKey(productId, sku) {
  return `${productId}::${sku || "base"}`;
}

// Normalisasi tipe field: alias lama/seed dipetakan ke tipe yang dirender
function normalizeFieldType(type) {
  const map = { short_text: "text", long_text: "textarea", tel: "phone" };
  return map[type] || type || "text";
}

// Field bertipe phone (atau label bernomor) menjadi sumber No. WhatsApp pesanan.
function getPhoneField(fields) {
  return (
    fields.find((f) => normalizeFieldType(f.type) === "phone") ||
    fields.find((f) => /whatsapp|\bwa\b|no\.?\s*hp|nomor\s*(telepon|hp|whatsapp)|\bphone\b|\btel\b/i.test(f.label || ""))
  );
}

// Field nama: label mengandung "nama", atau field teks pertama sebagai fallback.
function getNameField(fields) {
  return (
    fields.find((f) => normalizeFieldType(f.type) !== "phone" && /nama/i.test(f.label || "")) ||
    fields.find((f) => normalizeFieldType(f.type) === "text")
  );
}

export default function StorefrontPage() {
  // HOOK: Fetch store settings from Firestore
  const { settings, storeId, loading: loadingSettings } = useStoreSettings();
  
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [cart, setCart] = useState({});
  const [selectedVariant, setSelectedVariant] = useState({});
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | confirming | processing | success

  const [animateProductList] = useAutoAnimate();
  const [animateCartList] = useAutoAnimate();

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const totalQty = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);

  const buyerFields = useMemo(
    () => (settings?.custom_form_fields || []).slice().sort((a, b) => a.order - b.order),
    [settings?.custom_form_fields]
  );

  const phoneField = useMemo(() => getPhoneField(buyerFields), [buyerFields]);
  const nameField = useMemo(() => getNameField(buyerFields), [buyerFields]);

  // Fetch products from Firestore
  useEffect(() => {
    async function fetchProducts() {
      if (!storeId) return;
      try {
        setLoadingProducts(true);
        const prodRef = collection(db, "profiles", storeId, "products");
        const snap = await getDocs(prodRef);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(list);
      } catch (err) {
        console.error("Error fetching products:", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [storeId]);

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#14213D] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER DENGAN TOMBOL KEMBALI DI KIRI ATAS */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E4E4E0] pb-4">
          <div className="flex items-center gap-3">
            {/* Tombol Back Warna Kuning di Kiri Atas */}
            <Link
              href={`/admin/dashboard?storeid=${storeId || ""}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FCA311] text-[#14213D] font-semibold rounded-xl text-sm shadow-sm hover:opacity-90 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Kembali
            </Link>

            <div>
              <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Editor / {storeId || "Store"} (Via Link)
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-[#14213D]">Bangun katalog toko</h1>
            </div>
          </div>

          {/* Tombol "Simpan pengaturan & form" di kanan atas sudah dihapus sesuai permintaan */}
        </div>

        {/* KONTEN UTAMA HALAMAN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-[#E4E4E0] shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="font-semibold text-sm text-[#14213D]">Produk</div>
                <div className="text-xs text-[#6B7280]">
                  Pilih produk tersimpan untuk diedit, atau mulai produk baru.
                </div>
                <div className="p-3 bg-[#F4F4F0] rounded-xl text-xs text-[#6B7280]">
                  {loadingProducts ? "Memuat produk..." : `${products.length} produk tersedia di katalog toko.`}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#E4E4E0] shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="text-xs text-[#6B7280]">STORE BUILDER</div>
                <div className="font-bold text-lg text-[#14213D]">Tampilan & checkout</div>
                <div className="text-xs text-[#6B7280]">Perubahan disimpan otomatis ke profil aktif.</div>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-[#6B7280]">Nama toko</Label>
                    <Input 
                      value={settings?.store_name || "Monokrom"} 
                      readOnly 
                      className="mt-1 bg-[#F4F4F0] border-[#E4E4E0]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PREVIEW KANAN */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E4E4E0] shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-sm text-[#14213D]">{settings?.store_name || "Monokrom"}</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Buka</span>
              </div>
              <div className="p-4 bg-[#F4F4F0] rounded-xl text-center text-xs text-[#6B7280] mb-4">
                {products.length > 0 ? `${products.length} Produk aktif` : "Belum ada produk"}
              </div>
              {buyerFields.map((field) => (
                <div key={field.field_id} className="mt-3 text-xs">
                  <label className="font-medium text-[#14213D]">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="mt-1 p-2 bg-[#F4F4F0] border border-[#E4E4E0] rounded-lg text-[#6B7280]">
                    {field.placeholder || "Isian..."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}