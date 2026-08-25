"use client";
import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import DriveImage from "@/components/shared/DriveImage";
import { isUnlimitedStock } from "@/lib/storeProfiles";
import { getProductImages } from "@/lib/productMedia";

export default function ProductDetailModal({ product, isOpen, onClose, onAddToCart, themeColor }) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const variant = product?.has_variants ? product.variants?.[selectedVariantIndex] : null;
  const images = useMemo(() => getProductImages(product, variant), [product, variant]);
  const stock = variant ? variant.stock : product?.base_stock;
  const unlimited = variant?.unlimited_stock || product?.unlimited_stock || isUnlimitedStock(stock);
  useEffect(() => { if (isOpen) { setSelectedVariantIndex(0); setQuantity(0); setImageIndex(0); } }, [isOpen, product?.product_id]);
  useEffect(() => { setImageIndex(0); }, [selectedVariantIndex]);
  if (!isOpen || !product) return null;
  const price = variant?.price ?? product.selling_price ?? product.base_price;
  const soldOut = !unlimited && stock <= 0;
  const changeQty = (delta) => setQuantity((current) => Math.max(0, unlimited ? current + delta : Math.min(stock, current + delta)));
  return <div className="anim-fade-in fixed inset-0 z-40 flex items-center justify-center bg-[var(--ink)]/60 p-4"><div className="absolute inset-0" onClick={onClose} aria-hidden="true" /><div role="dialog" aria-modal="true" className="anim-pop-in relative z-50 w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--paper)] shadow-2xl">
    <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-[var(--paper)]/80 p-2" aria-label="Tutup"><X data-icon="inline-start" /></button>
    <div className="relative aspect-square bg-[var(--canvas)]">{images.length ? <DriveImage src={images[imageIndex]} alt={product.name} className="size-full object-cover" /> : <div className="size-full" />}{images.length > 1 && <><button type="button" onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 rounded-full bg-[var(--paper)]/80 p-2" aria-label="Gambar sebelumnya"><ChevronLeft data-icon="inline-start" /></button><button type="button" onClick={() => setImageIndex((imageIndex + 1) % images.length)} className="absolute right-3 top-1/2 rounded-full bg-[var(--paper)]/80 p-2" aria-label="Gambar berikutnya"><ChevronRight data-icon="inline-start" /></button><div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">{images.map((_, i) => <button key={i} type="button" onClick={() => setImageIndex(i)} aria-label={`Gambar ${i + 1}`} className={`size-2 rounded-full ${i === imageIndex ? "bg-[var(--marigold)]" : "bg-[var(--paper)]/70"}`} />)}</div></>}</div>
    <div className="flex flex-col gap-4 p-5"><div><h2 className="font-display text-lg font-semibold">{product.name}</h2>{product.description && <p className="mt-1 text-sm text-[var(--muted)]">{product.description}</p>}<p className="mt-2 font-mono text-lg font-semibold" style={{ color: themeColor || "var(--ink)" }}>Rp{Number(price || 0).toLocaleString("id-ID")}</p></div>
      {product.has_variants && <div className="flex flex-col gap-2"><label className="text-xs font-medium">Pilih Varian</label><div className="flex flex-wrap gap-2">{(product.variants || []).map((v, i) => { const active = i === selectedVariantIndex && quantity > 0; const unavailable = !v.unlimited_stock && v.stock <= 0; return <button key={v.sku || i} type="button" disabled={unavailable} onClick={() => { setSelectedVariantIndex(i); setQuantity(0); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? "border-[var(--marigold)] bg-[var(--marigold)]" : "border-[var(--line)] bg-[var(--paper)]"} ${unavailable ? "cursor-not-allowed opacity-40 line-through" : ""}`}>{v.name}</button>; })}</div></div>}
      <div className="flex items-center gap-3"><button type="button" onClick={() => changeQty(-1)} disabled={quantity <= 0} className="rounded-full border border-[var(--line)] p-2 transition-all duration-200 active:scale-95 disabled:opacity-30" aria-label="Kurangi jumlah"><Minus data-icon="inline-start" /></button><span className="w-8 text-center font-mono">{quantity}</span><button type="button" onClick={() => changeQty(1)} disabled={soldOut} className="rounded-full border border-[var(--line)] p-2 transition-all duration-200 active:scale-95 disabled:opacity-30" aria-label="Tambah jumlah"><Plus data-icon="inline-start" /></button><span className="text-xs text-[var(--muted)]">{unlimited ? "Stok tidak terbatas" : `Sisa stok: ${Math.max(0, stock || 0)}`}</span></div>
      <button type="button" disabled={!quantity || soldOut} onClick={() => { onAddToCart(product, selectedVariantIndex, quantity); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--marigold)] py-3 text-sm font-semibold transition-all duration-200 hover:brightness-95 active:scale-95 disabled:opacity-40"><ShoppingCart data-icon="inline-start" /> Tambah ke Keranjang ({quantity})</button>
    </div></div></div>;
}
