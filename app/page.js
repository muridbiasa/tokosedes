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
} from "lucide-react";
import DriveImage from "@/components/shared/DriveImage";
import { mockStore, mockCustomFields } from "@/lib/mockData"; // mockProducts sudah dihapus

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

export default function StorefrontPage() {
  // STATE BARU: Menampung data produk dari Firebase
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // { [cartKey]: { product_id, sku, name, price, qty, maxStock } }
  const [cart, setCart] = useState({});
  // varian yang sedang dipilih per produk di kartu (belum tentu masuk keranjang)
  const [selectedVariant, setSelectedVariant] = useState({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState("idle"); // idle | confirming | processing | success

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const totalQty = cartItems.reduce((sum, i) => sum + i.qty, 0);
  const totalAmount = cartItems.reduce((sum, i) => sum + i.qty * i.price, 0);

  // MENGAMBIL DATA KATALOG DARI FIRESTORE
  useEffect(() => {
    async function fetchProducts() {
      try {
        const querySnapshot = await getDocs(collection(db, 'stores', 'tokosedes-prod', 'products'));
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
  }, []);

  function getSelectedVariant(product) {
    if (!product.has_variants) return null;
    const index = selectedVariant[product.product_id] ?? 0;
    return product.variants[index];
  }

  function addToCart(product) {
    const variant = getSelectedVariant(product);
    const sku = variant?.sku || product.product_id;
    const price = variant ? variant.price : product.base_price;
    const stock = variant ? variant.stock : product.base_stock;
    const name = variant ? `${product.name} - ${variant.name}` : product.name;
    const key = cartKey(product.product_id, sku);

    setCart((prev) => {
      const existingQty = prev[key]?.qty || 0;
      if (existingQty + 1 > stock) return prev; // jaga-jaga, tombol + juga sudah disabled saat stok habis
      return {
        ...prev,
        [key]: {
          key,
          product_id: product.product_id,
          sku,
          name,
          price,
          qty: existingQty + 1,
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
      if (nextQty > item.maxStock) return prev; // edge case 5.1: cegah melebihi stok real-time
      return { ...prev, [key]: { ...item, qty: nextQty } };
    });
  }

  function updateCustomField(fieldId, value) {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setFormErrors((prev) => ({ ...prev, [fieldId]: undefined }));
  }

  function validateForm() {
    const errors = {};
    if (!customerName.trim()) errors.customerName = "Nama wajib diisi";
    if (!customerPhone.trim()) errors.customerPhone = "No. WhatsApp wajib diisi";

    for (const field of mockCustomFields) {
      if (field.is_required && !customFieldValues[field.field_id]) {
        errors[field.field_id] = "Wajib diisi";
      }
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
          storeId: 'tokosedes-prod',
          customerName,
          customerPhone,
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
    setCustomerName("");
    setCustomerPhone("");
    setCustomFieldValues({});
    setCheckoutState("idle");
    setCartSheetOpen(false);
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] pb-28">
      {/* --- Header Toko --- */}
      <header className="border-b border-[var(--line)] bg-[var(--paper)] px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-semibold text-[var(--ink)]">
              {mockStore.store_name}
            </h1>
            {mockStore.is_active ? (
              <span className="flex items-center gap-1 rounded-full bg-[var(--pine)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--pine)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--pine)]" /> Buka
              </span>
            ) : (
              <span className="rounded-full bg-[var(--brick)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--brick)]">
                Tutup
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{mockStore.description}</p>
        </div>
      </header>

      {/* --- Katalog Produk --- */}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                selectedIndex={selectedVariant[product.product_id] ?? 0}
                onSelectVariant={(index) =>
                  setSelectedVariant((prev) => ({ ...prev, [product.product_id]: index }))
                }
                onAddToCart={() => addToCart(product)}
              />
            ))}
          </div>
        )}

        {/* --- Data Pembeli & Field Kustom --- */}
        <section className="mt-8 space-y-4 rounded-lg border border-[var(--line)] bg-[var(--paper)] p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Data Pembeli
          </h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink)]">
              Nama Lengkap <span className="text-[var(--brick)]">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setFormErrors((prev) => ({ ...prev, customerName: undefined }));
              }}
              placeholder="Nama sesuai pesanan"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)] ${
                formErrors.customerName ? "border-[var(--brick)]" : "border-[var(--line)]"
              }`}
            />
            {formErrors.customerName && (
              <p className="mt-1 text-xs text-[var(--brick)]">{formErrors.customerName}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--ink)]">
              No. WhatsApp <span className="text-[var(--brick)]">*</span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                setFormErrors((prev) => ({ ...prev, customerPhone: undefined }));
              }}
              placeholder="081234567890"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)] ${
                formErrors.customerPhone ? "border-[var(--brick)]" : "border-[var(--line)]"
              }`}
            />
            {formErrors.customerPhone && (
              <p className="mt-1 text-xs text-[var(--brick)]">{formErrors.customerPhone}</p>
            )}
          </div>

          {mockCustomFields
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((field) => (
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

      {/* --- Sticky Bottom Bar --- */}
      {totalQty > 0 && checkoutState === "idle" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--paper)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            onClick={() => setCartSheetOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-[var(--muted)]"
          >
            <span className="flex items-center gap-1">
              <ShoppingCart size={13} /> {totalQty} item di keranjang
            </span>
            {cartSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {cartSheetOpen && (
            <div className="max-h-64 overflow-y-auto border-t border-dashed border-[var(--line)] px-4 py-3">
              <ul className="space-y-2">
                {cartItems.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--ink)]">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatRupiah(item.price)} x {item.qty}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeQty(item.key, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)]"
                        aria-label="Kurangi"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-4 text-center text-xs font-mono">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(item.key, 1)}
                        disabled={item.qty >= item.maxStock}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] disabled:opacity-30"
                        aria-label="Tambah"
                      >
                        <Plus size={12} />
                      </button>
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
            <button
              type="button"
              onClick={handleCheckout}
              className="rounded-md bg-[var(--marigold)] px-6 py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm hover:brightness-95"
            >
              Bayar Sekarang
            </button>
          </div>
        </div>
      )}

      {/* --- Modal Konfirmasi / Trigger Midtrans Snap --- */}
      {checkoutState !== "idle" && (
        <CheckoutModal
          state={checkoutState}
          cartItems={cartItems}
          totalAmount={totalAmount}
          customerName={customerName}
          onClose={() => setCheckoutState("idle")}
          onConfirm={confirmPayment}
          onDone={resetAfterSuccess}
        />
      )}
    </div>
  );
}

function ProductCard({ product, selectedIndex, onSelectVariant, onAddToCart }) {
  const variant = product.has_variants ? product.variants[selectedIndex] : null;
  const price = variant ? variant.price : product.base_price;
  const stock = variant ? variant.stock : product.base_stock;
  const soldOut = stock <= 0;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--paper)]">
      <div className="aspect-square w-full bg-[var(--canvas)]">
        <DriveImage
          src={product.images?.[0]}
          alt={product.name}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="space-y-2 p-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--ink)]">{product.name}</h3>
          <p className="line-clamp-2 text-xs text-[var(--muted)]">{product.description}</p>
        </div>

        <p className="font-mono text-sm font-semibold text-[var(--ink)]">{formatRupiah(price)}</p>

        {product.has_variants && (
          <div className="flex flex-wrap gap-1.5">
            {product.variants.map((v, i) => {
              const vSoldOut = v.stock <= 0;
              return (
                <button
                  key={v.sku}
                  type="button"
                  disabled={vSoldOut}
                  onClick={() => onSelectVariant(i)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    i === selectedIndex
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] text-[var(--ink)]"
                  } ${vSoldOut ? "opacity-40 line-through" : ""}`}
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
          <p className="text-[11px] text-[var(--muted)]">Sisa stok: {stock}</p>
        )}

        <button
          type="button"
          disabled={soldOut}
          onClick={onAddToCart}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--ink)] py-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Plus size={13} /> Tambah ke Keranjang
        </button>
      </div>
    </div>
  );
}

function CustomFieldInput({ field, value, error, onChange }) {
  const base = `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--marigold)] ${
    error ? "border-[var(--brick)]" : "border-[var(--line)]"
  }`;

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--ink)]">
        {field.label}
        {field.is_required && <span className="text-[var(--brick)]"> *</span>}
      </label>

      {field.type === "text" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      {field.type === "textarea" && (
        <textarea
          rows={2}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      {field.type === "number" && (
        <input
          type="number"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={base}
        />
      )}

      {field.type === "dropdown" && (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">Pilih salah satu</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}

      {field.type === "radio" && (
        <div className="space-y-1.5">
          {field.options.map((opt) => (
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

      {field.type === "checkbox" && (
        <div className="space-y-1.5">
          {field.options.map((opt) => {
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
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--muted)] hover:text-[var(--ink)]"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
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

            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-md bg-[var(--marigold)] py-2.5 text-sm font-semibold text-[var(--ink)] hover:brightness-95"
            >
              Lanjut ke Pembayaran
            </button>
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
            <button
              type="button"
              onClick={onDone}
              className="mt-2 w-full rounded-md bg-[var(--ink)] py-2.5 text-sm font-semibold text-white"
            >
              Kembali ke Beranda
            </button>
          </div>
        )}
      </div>
    </div>
  );
}