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

/**
 * app/page.js
 *
 * Storefront Pembeli — UI by Claude, Backend Logic by Production System.
 * Sistem kini menarik data dari Firestore dan memicu Midtrans Snap asli.
 */

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

// Kunci unik item keranjang: gabungan product_id + sku (atau "base" kalau tanpa varian)
function cartKey(productId, sku) {
  return `${productId}::${sku || "base"}`;
}

// Normalisasi tipe field: alias lama/seed dipetakan ke tipe yang dirender,
// sehingga form dinamis tahan terhadap semua konfigurasi admin.
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
  
  // STATE BARU: Menampung data produk dari Firebase
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // { [cartKey]: { product_id, sku, name, price, qty, maxStock } }
  const [cart, setCart] = useState({});
  // varian yang sedang dipilih per produk di kartu (belum tentu masuk keranjang)
  const [selectedVariant, setSelectedVariant] = useState({});
  
  // STATE BARU: Modal product detail
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | confirming | processing | success

  // Transisi mulus saat item masuk/keluar DOM — murni animasi CSS (WAAPI),
  // tanpa re-render tambahan; hemat memori untuk perangkat low-end.
  const [animateProductList] = useAutoAnimate();
  const [animateCartList] = useAutoAnimate();

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const totalQty = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);

  // Form "Data Pembeli" 100% dinamis: hanya dari custom_form_fields profil toko.
  const buyerFields = useMemo(
    () => (settings?.custom_form_fields || []).slice().sort((a, b) => a.order - b.order),
    [settings]
  );
  const phoneField = getPhoneField(buyerFields);
  const nameField = getNameField(buyerFields);

  function fieldValueText(field) {
    if (!field) return "";
    const v = customFieldValues[field.field_id];
    if (v == null) return "";
    return Array.isArray(v) ? v.join(", ") : String(v);
  }
  const derivedName = (nameField ? fieldValueText(nameField) : "").trim();
  const derivedPhone = (phoneField ? fieldValueText(phoneField) : "").trim();

  // MENGAMBIL DATA KATALOG DARI FIRESTORE
  useEffect(() => {
    async function fetchProducts() {
      if (!storeId) {
        setProducts([]);
        setLoadingProducts(false);
        return;
      }
      try {
        const querySnapshot = await getDocs(collection(db, 'stores', storeId, 'products'));
        const items = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Memetakan struktur Firebase agar cocok dengan UI buatan Claude
          items.push({ 
            product_id: doc.id,
            name: data.name || "Tanpa Nama",
            description: data.description || "",
            base_price: data.price || 0,
            base_stock: data.stock || 0,
            has_variants: data.has_variants || false,
            variants: data.variants || [],
            images: data.imageUrl ? [data.imageUrl] : (data.images || []),
            ...data
          });
        });
        setProducts(items);
      } catch (err) {
        console.error("Gagal mengambil data produk Firestore:", err);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, [storeId]);

  function getSelectedVariant(product) {
    if (!product.has_variants) return null;
    const index = selectedVariant[product.product_id] ?? 0;
    return product.variants[index];
  }

  function addToCart(product, variantIndex = null, qty = 1) {
    // Support both old API (no args) and new modal API (with variantIndex and qty)
    const variant = variantIndex !== null 
      ? product.variants[variantIndex] 
      : getSelectedVariant(product);
    
    const sku = variant?.sku || product.product_id;
    const price = variant ? variant.price : product.base_price;
    const stock = variant ? variant.stock : product.base_stock;
    const name = variant ? `${product.name} - ${variant.name}` : product.name;
    const key = cartKey(product.product_id, sku);

    setCart((prev) => {
      const existingQty = prev[key]?.qty || 0;
      const newQty = existingQty + qty;
      if (!stockAllows(stock, newQty)) return prev;
      return {
        ...prev,
        [key]: {
          key,
          product_id: product.product_id,
          sku,
          name,
          price,
          qty: newQty,
          maxStock: stock,
        },
      };
    });
  }

  function changeQty(key, delta) {
    setCart((prev) => {
      const item = prev[key];
      if (!item) return prev;
      const nextQty = item.qty + delta;

      if (nextQty <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (!stockAllows(item.maxStock, nextQty)) return prev;
      return { ...prev, [key]: { ...item, qty: nextQty } };
    });
  }

  function updateCustomField(fieldId, value) {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setFormErrors((prev) => ({ ...prev, [fieldId]: undefined }));
  }

  function validateForm() {
    const errors = {};

    // Wajib isi per field, murni dari konfigurasi admin.
    for (const field of buyerFields) {
      const v = customFieldValues[field.field_id];
      if (field.is_required && (v === undefined || v === "" || (Array.isArray(v) && !v.length))) {
        errors[field.field_id] = "Wajib diisi";
      }
    }

    // No. WhatsApp diambil dari field bertipe phone / berlabel nomor.
    if (!phoneField) {
      errors.__config = "Toko ini belum mengatur field nomor WhatsApp — pembayaran belum bisa diproses.";
    } else {
      const pv = derivedPhone;
      if (!pv) errors[phoneField.field_id] = "No. WhatsApp wajib diisi";
      else if (!isValidPhone(pv)) errors[phoneField.field_id] = "Gunakan 8-15 digit angka";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleCheckout() {
    if (totalQty === 0) return;
    if (!validateForm()) {
      setCartSheetOpen(true); // buka sheet supaya pembeli lihat error-nya
      return;
    }
    setCheckoutState("confirming");
  }

  // EKSEKUSI PEMBAYARAN MIDTRANS ASLI
  async function confirmPayment() {
    setCheckoutState("processing");

    try {
      const res = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          customerName: derivedName || "Pelanggan",
          customerPhone: derivedPhone,
          items: cartItems.map(item => ({
            id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.qty
          })),
          notes: JSON.stringify(customFieldValues) || ''
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan');

      // Panggil Pop-up Pembayaran Midtrans Snap
      if (window.snap && data.snapToken) {
        window.snap.pay(data.snapToken, {
          onSuccess: function () {
            alert('Pembayaran Berhasil! Data otomatis tercatat ke Sheets.');
            resetAfterSuccess();
            window.location.reload();
          },
          onPending: function () {
            alert('Menunggu Pembayaran! Silakan selesaikan tagihan Anda.');
            setCheckoutState("idle");
          },
          onError: function () {
            alert('Pembayaran Gagal! Silakan coba lagi.');
            setCheckoutState("idle");
          },
          onClose: function () {
            alert('Jendela pembayaran ditutup sebelum selesai.');
            setCheckoutState("idle");
          }
        });
      } else {
        alert('Gagal memuat Midtrans Snap. Pastikan script SDK terpasang di layout.');
        setCheckoutState("idle");
      }
    } catch (err) {
      alert(err.message);
      setCheckoutState("idle");
    }
  }

  function resetAfterSuccess() {
    setCart({});
    setCustomFieldValues({});
    setCheckoutState("idle");
    setCartSheetOpen(false);
  }

  return (
    <div
      className="min-h-screen bg-[var(--canvas)] pb-28"
      style={
        settings?.fontFamily && settings.fontFamily !== "sans-serif"
          ? { fontFamily: `'${settings.fontFamily}', 'Inter', sans-serif` }
          : undefined
      }
    >
      {/* --- Header Toko --- */}
      <header 
        className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-6"
        style={{ 
          borderBottomColor: settings?.themeColor ? `${settings.themeColor}33` : 'var(--line)',
          backgroundColor: settings?.themeColor ? `${settings.themeColor}11` : 'var(--paper)'
        }}
      >
        <div className="mx-auto max-w-2xl">
          {loadingSettings ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--ink)]" />
              <span className="text-sm text-[var(--muted)]">Memuat toko...</span>
            </div>
          ) : !settings?.isStoreOpen ? (
            // STORE CLOSED UI
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--brick)]/10 mb-4">
                <Store className="w-8 h-8 text-[var(--brick)]" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-[var(--ink)] mb-2">
                Toko Sedang Tutup
              </h1>
              <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
                {settings?.closedMessage || "Maaf, toko sedang tidak menerima pesanan saat ini. Silakan kembali lagi nanti."}
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--brick)]/10 px-4 py-2 text-xs font-medium text-[var(--brick)]">
                <span className="h-2 w-2 rounded-full bg-[var(--brick)] animate-pulse" />
                Status: Tutup Sementara
              </div>
            </div>
          ) : (
            // STORE OPEN - Normal Header
            <div className="flex items-center gap-2">
              <h1
                className="text-xl font-semibold"
                style={{ color: settings?.themeColor || 'var(--ink)' }}
              >
                {settings?.storeName}
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-[var(--pine)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--pine)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--pine)]" /> Buka
              </span>
            </div>
          )}
          
          {/* Description - only show when store is open */}
          {settings?.isStoreOpen && (
            <p 
              className="mt-1 text-sm text-[var(--muted)]"
              style={{ color: settings?.themeColor ? `${settings.themeColor}cc` : 'var(--muted)' }}
            >
              {settings?.description}
            </p>
          )}
        </div>
      </header>

      {/* --- Katalog Produk --- */}
      {!loadingSettings && settings?.isStoreOpen && (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Katalog Produk
        </h2>

        {/* LOADING INDICATOR / RENDER PRODUK */}
        {loadingProducts ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--ink)]" />
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">
            Belum ada produk di database Firestore.
          </div>
        ) : (
          <div ref={animateProductList} className={`grid gap-4 ${getGridClasses(settings?.catalogGridSize)}`}>
            {products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                selectedIndex={selectedVariant[product.product_id] ?? 0}
                onSelectVariant={(index) =>
                  setSelectedVariant((prev) => ({ ...prev, [product.product_id]: index }))
                }
                onOpenModal={() => {
                  setSelectedProduct(product);
                  setModalOpen(true);
                }}
                themeColor={settings?.themeColor}
              />
            ))}
          </div>
        )}

        {/* --- Data Pembeli & Field Kustom: 100% dinamis dari konfigurasi admin --- */}
        <section className="mt-8 space-y-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Data Pembeli
          </h2>

          {buyerFields.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              Belum ada form data pembeli yang dikonfigurasi admin.
            </p>
          )}

          {!phoneField && buyerFields.length > 0 && (
            <p role="alert" className="rounded-md border border-[var(--brick)]/40 bg-[var(--brick)]/10 px-3 py-2 text-xs text-[var(--brick)]">
              Toko ini belum mengatur field nomor WhatsApp (tipe <em>Nomor telepon</em>) — pembayaran belum bisa diproses.
            </p>
          )}
          {formErrors.__config && (
            <p role="alert" className="text-xs text-[var(--brick)]">{formErrors.__config}</p>
          )}

          {buyerFields.map((field) => (
            <CustomFieldInput
              key={field.field_id}
              field={field}
              value={customFieldValues[field.field_id]}
              error={formErrors[field.field_id]}
              onChange={(value) => updateCustomField(field.field_id, value)}
            />
          ))}
        </section>
      </main>
      )}

      {/* --- Sticky Bottom Bar --- */}
      {totalQty > 0 && checkoutState === "idle" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--paper)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCartSheetOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-none px-4 py-2 text-xs font-normal text-[var(--muted)] transition-all duration-200 active:scale-[0.99] sm:w-auto"
          >
            <span className="flex items-center gap-1">
              <ShoppingCart size={13} /> {totalQty} item di keranjang
            </span>
            {cartSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>

          {cartSheetOpen && (
            <div className="max-h-64 overflow-y-auto border-t border-dashed border-[var(--line)] px-4 py-3">
              <ul ref={animateCartList} className="space-y-2">
                {cartItems.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--ink)]">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatRupiah(item.price)} x {item.qty}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => changeQty(item.key, -1)}
                        className="h-6 w-6 rounded-full p-0 transition-all duration-200 active:scale-95"
                        aria-label="Kurangi"
                      >
                        <Minus size={12} />
                      </Button>
                      <span className="w-4 text-center text-xs font-mono">{item.qty}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => changeQty(item.key, 1)}
                        disabled={!isUnlimitedStock(item.maxStock) && item.qty >= item.maxStock}
                        className="h-6 w-6 rounded-full p-0 transition-all duration-200 active:scale-95"
                        aria-label="Tambah"
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Total</p>
              <p className="font-mono text-base font-semibold text-[var(--ink)]">
                {formatRupiah(totalAmount)}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleCheckout}
              className="px-6 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all duration-200 hover:brightness-95 active:scale-95 sm:w-auto"
            >
              Bayar Sekarang
            </Button>
          </div>
        </div>
      )}

      {/* --- Modal Konfirmasi / Trigger Midtrans Snap --- */}
      {checkoutState !== "idle" && (
        <CheckoutModal
          state={checkoutState}
          cartItems={cartItems}
          totalAmount={totalAmount}
          customerName={derivedName || "(nama belum diisi)"}
          onClose={() => setCheckoutState("idle")}
          onConfirm={confirmPayment}
          onDone={resetAfterSuccess}
        />
      )}

      {/* --- Product Detail Modal (Phase 2) --- */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onAddToCart={(product, variantIndex, qty) => addToCart(product, variantIndex, qty)}
        themeColor={settings?.themeColor}
      />
    </div>
  );
}

function ProductCard({ product, selectedIndex, onSelectVariant, onOpenModal, themeColor }) {
  const variant = product.has_variants ? product.variants[selectedIndex] : null;
  const price = variant ? variant.price : product.base_price;
  const stock = variant ? variant.stock : product.base_stock;
  const soldOut = !isUnlimitedStock(stock) && stock <= 0;

  return (
    <Card
      onClick={onOpenModal}
      className="cursor-pointer overflow-hidden border-[var(--line)] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square w-full bg-[var(--canvas)]">
        <DriveImage
          src={product.images?.[0]}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <CardContent className="space-y-2 p-3 pt-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--ink)]">{product.name}</h3>
          <p className="line-clamp-2 text-xs text-[var(--muted)]">{product.description}</p>
        </div>

        <p
          className="font-mono text-sm font-semibold"
          style={{ color: themeColor || 'var(--ink)' }}
        >
          {formatRupiah(price)}
        </p>

        {product.has_variants && (
          <div className="flex flex-wrap gap-1.5">
            {product.variants.map((v, i) => {
              const vSoldOut = !isUnlimitedStock(v.stock) && v.stock <= 0;
              return (
                <button
                  key={v.sku}
                  type="button"
                  disabled={vSoldOut}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectVariant(i);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200 active:scale-95 ${
                    i === selectedIndex
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)]"
                  } ${vSoldOut ? "opacity-40 line-through" : ""}`}
                  style={i === selectedIndex && themeColor ? {
                    backgroundColor: themeColor,
                    borderColor: themeColor,
                  } : undefined}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        )}

        {soldOut ? (
          <p className="text-xs font-medium text-[var(--brick)]">Stok habis</p>
        ) : (
          <p className="text-[11px] text-[var(--muted)]">{isUnlimitedStock(stock) ? "Stok tersedia" : `Sisa stok: ${stock}`}</p>
        )}

        {/* Removed direct Add to Cart button - user must click card to open modal */}
        <div className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-[var(--muted)] bg-[var(--canvas)]">
          <ShoppingCart size={13} /> Klik untuk detail
        </div>
      </CardContent>
    </Card>
  );
}

function CustomFieldInput({ field, value, error, onChange }) {
  const base = `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)] ${
    error ? "border-[var(--brick)]" : "border-[var(--line)]"
  }`;
  // Kelas error untuk <Input> shadcn (menimpa border-input bila invalid).
  const inputErrorClass = error
    ? "border-[var(--brick)] focus-visible:ring-[var(--brick)]"
    : undefined;
  // Normalisasi tipe: alias lama/seed (short_text, long_text, tel) dipetakan,
  // sehingga semua tipe hasil konfigurasi admin pasti punya elemen inputnya.
  const type = normalizeFieldType(field.type);
  const options = Array.isArray(field.options) ? field.options : [];

  return (
    <div>
      <Label className="mb-1 block text-xs font-medium text-[var(--ink)]">
        {field.label}
        {field.is_required && <span className="text-[var(--brick)]"> *</span>}
      </Label>

      {type === "text" && (
        <Input
          type="text"
          value={value || ""}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          className={`transition-all duration-200 ${inputErrorClass || ""}`}
        />
      )}

      {type === "phone" && (
        <Input
          type="tel"
          inputMode="numeric"
          placeholder="081234567890"
          value={value || ""}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          className={`transition-all duration-200 ${inputErrorClass || ""}`}
        />
      )}

      {type === "textarea" && (
        <textarea
          rows={2}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      {type === "number" && (
        <Input
          type="number"
          value={value || ""}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
          className={`transition-all duration-200 ${inputErrorClass || ""}`}
        />
      )}

      {type === "info" && (
        <p className="rounded-md bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--muted)]">
          {options.filter(Boolean).join(" ") || "—"}
        </p>
      )}

      {type === "dropdown" && (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Pilih salah satu</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {type === "radio" && (
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="radio"
                name={field.field_id}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-[var(--marigold)] focus:ring-[var(--marigold)]"
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {type === "checkbox" && (
        <div className="space-y-1.5">
          {options.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      selected ? current.filter((o) => o !== opt) : [...current, opt]
                    );
                  }}
                  className="rounded text-[var(--marigold)] focus:ring-[var(--marigold)]"
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-[var(--brick)]">{error}</p>}
    </div>
  );
}

function CheckoutModal({ state, cartItems, totalAmount, customerName, onClose, onConfirm, onDone }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-[var(--paper)] p-5 sm:rounded-2xl">
        {state === "confirming" && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[var(--ink)]">
                Konfirmasi Pesanan
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 p-0 transition-all duration-200 active:scale-95"
                aria-label="Tutup"
              >
                <X size={18} />
              </Button>
            </div>

            <p className="mb-3 text-xs text-[var(--muted)]">
              Atas nama <span className="font-medium text-[var(--ink)]">{customerName}</span>
            </p>

            <ul className="mb-3 max-h-48 space-y-1.5 overflow-y-auto border-y border-dashed border-[var(--line)] py-3">
              {cartItems.map((item) => (
                <li key={item.key} className="flex justify-between text-sm">
                  <span className="text-[var(--ink)]">
                    {item.name} <span className="text-[var(--muted)]">x{item.qty}</span>
                  </span>
                  <span className="font-mono text-[var(--ink)]">
                    {formatRupiah(item.price * item.qty)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mb-4 flex justify-between">
              <span className="text-sm font-medium text-[var(--ink)]">Total Bayar</span>
              <span className="font-mono text-lg font-semibold text-[var(--ink)]">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            <p className="mb-4 flex items-start gap-1.5 text-[11px] text-[var(--muted)]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Sistem akan memotong stok secara real-time dan langsung membuka halaman pembayaran resmi Midtrans setelah Anda menekan tombol di bawah ini.
            </p>

            <Button
              type="button"
              onClick={onConfirm}
              className="w-full py-2.5 text-sm font-semibold text-[var(--ink)] transition-all duration-200 hover:brightness-95 active:scale-95 sm:w-auto sm:py-2.5"
            >
              Lanjut ke Pembayaran
            </Button>
          </>
        )}

        {state === "processing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--ink)]" />
            <p className="text-sm text-[var(--muted)]">Memeriksa stok & menyiapkan pembayaran…</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pine)]/10 text-[var(--pine)]">
              <Check size={24} />
            </div>
            <h3 className="font-display text-base font-semibold text-[var(--ink)]">
              Transaksi Selesai
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Terima kasih! Jika jendela tidak tertutup otomatis, silakan klik tombol selesai.
            </p>
            <Button
              type="button"
              onClick={onDone}
              className="mt-2 w-full bg-[var(--ink)] py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--ink)]/90 active:scale-95 sm:w-auto"
            >
              Kembali ke Beranda
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
