/**
 * Penentu apakah item (produk/varian) bersifat "tanpa batas" (unlimited).
 *
 * Dipakai oleh /api/order/create dan /api/midtrans/webhook agar validasi,
 * pemotongan, dan pengembalian stok memakai definisi yang sama persis.
 * Modul ini murni fungsi — aman untuk server maupun client.
 *
 * Prioritas:
 *  1. Flag eksplisit pada varian (unlimited_stock / isUnlimitedStock)
 *  2. Flag eksplisit pada produk
 *  3. Data legacy tanpa flag apa pun: ikuti konvensi yang selama ini dipakai
 *     storefront (stok 0 atau absen = tanpa batas), supaya produk lama tidak
 *     ditolak checkout dengan pesan "tersisa 0".
 */
export function resolveUnlimitedStock(product = {}, variant = null) {
  if (variant) {
    if (variant.unlimited_stock !== undefined) return Boolean(variant.unlimited_stock);
    if (variant.isUnlimitedStock !== undefined) return Boolean(variant.isUnlimitedStock);
  }
  if (product.unlimited_stock !== undefined) return Boolean(product.unlimited_stock);
  if (product.isUnlimitedStock !== undefined) return Boolean(product.isUnlimitedStock);

  const raw = variant ? variant.stock : (product.base_stock ?? product.stock);
  const stock = Number(raw ?? 0);
  return !(stock > 0);
}
