"use client";

import { useState, useEffect } from "react";
import { X, Minus, Plus, ShoppingCart } from "lucide-react";
import DriveImage from "@/components/shared/DriveImage";

/**
 * ProductDetailModal Component
 * 
 * Features:
 * - Dynamic image that updates when variant is selected
 * - Variant selection chips/buttons
 * - Quantity selector [-] [1] [+]
 * - Add to Cart button that saves to global cart state
 */
export default function ProductDetailModal({ 
  product, 
  isOpen, 
  onClose, 
  onAddToCart,
  themeColor 
}) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Reset state when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      setSelectedVariantIndex(0);
      setQuantity(1);
    }
  }, [isOpen, product?.product_id]);

  if (!isOpen || !product) return null;

  const variant = product.has_variants ? product.variants[selectedVariantIndex] : null;
  const price = variant ? variant.price : product.base_price;
  const stock = variant ? variant.stock : product.base_stock;
  const soldOut = stock <= 0;

  // Get current image - use variant image if available, otherwise fallback to product image
  const currentImage = variant?.imageUrl 
    ? variant.imageUrl 
    : product.images?.[0] || product.imageUrl;

  function handleVariantSelect(index) {
    setSelectedVariantIndex(index);
    setQuantity(1); // Reset quantity when changing variant
  }

  function handleQuantityChange(delta) {
    setQuantity((prev) => {
      const nextQty = prev + delta;
      if (nextQty < 1) return 1;
      if (nextQty > stock) return stock;
      return nextQty;
    });
  }

  function handleAddToCart() {
    if (soldOut) return;
    
    onAddToCart(product, selectedVariantIndex, quantity);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div className="relative z-50 w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--paper)] shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--paper)]/80 text-[var(--muted)] backdrop-blur-sm transition-colors hover:text-[var(--ink)]"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col">
          {/* Product Image */}
          <div className="aspect-square w-full bg-[var(--canvas)]">
            <DriveImage
              src={currentImage}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Product Details */}
          <div className="flex-1 space-y-4 p-5">
            {/* Title & Price */}
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--ink)]">
                {product.name}
              </h2>
              {product.description && (
                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">
                  {product.description}
                </p>
              )}
              <p 
                className="mt-2 font-mono text-lg font-semibold"
                style={{ color: themeColor || 'var(--ink)' }}
              >
                {formatRupiah(price)}
              </p>
            </div>

            {/* Stock Info */}
            {soldOut ? (
              <p className="text-xs font-medium text-[var(--brick)]">Stok habis</p>
            ) : (
              <p className="text-xs text-[var(--muted)]">Sisa stok: {stock}</p>
            )}

            {/* Variant Selection */}
            {product.has_variants && product.variants.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[var(--ink)]">
                  Pilih Varian
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v, i) => {
                    const vSoldOut = v.stock <= 0;
                    const isSelected = i === selectedVariantIndex;
                    return (
                      <button
                        key={v.sku}
                        type="button"
                        disabled={vSoldOut}
                        onClick={() => handleVariantSelect(i)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-transparent text-white"
                            : "border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink)]"
                        } ${vSoldOut ? "opacity-40 line-through cursor-not-allowed" : ""}`}
                        style={isSelected && themeColor ? {
                          backgroundColor: themeColor,
                        } : undefined}
                      >
                        {v.name}
                        {vSoldOut && " (Habis)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            {!soldOut && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-[var(--ink)]">
                  Jumlah
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--canvas)] disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Kurangi jumlah"
                  >
                    <Minus size={16} />
                  </button>
                  
                  <span className="w-12 text-center text-base font-semibold text-[var(--ink)]">
                    {quantity}
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= stock}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--ink)] transition-colors hover:bg-[var(--canvas)] disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Tambah jumlah"
                  >
                    <Plus size={16} />
                  </button>
                  
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    Max: {stock}
                  </span>
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            <button
              type="button"
              disabled={soldOut}
              onClick={handleAddToCart}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
              style={{ backgroundColor: themeColor || 'var(--ink)' }}
            >
              <ShoppingCart size={18} />
              Tambah ke Keranjang ({quantity})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRupiah(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}
