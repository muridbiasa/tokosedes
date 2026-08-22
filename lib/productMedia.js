import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function fileToWebp(file, quality = 0.82) {
  if (!file?.type?.startsWith("image/")) throw new Error("Pilih file gambar yang valid");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("Gagal mengonversi gambar");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

export async function uploadProductImage(file, storeId, productId = "draft") {
  const webp = await fileToWebp(file);
  const path = `stores/${storeId}/products/${productId}/${crypto.randomUUID()}.webp`;
  const snapshot = await uploadBytes(ref(storage, path), webp, { contentType: "image/webp" });
  return getDownloadURL(snapshot.ref);
}

export async function uploadFilesInChunks(files, storeId, productId, onProgress) {
  const urls = [];
  for (let index = 0; index < files.length; index += 1) {
    urls.push(await uploadProductImage(files[index], storeId, productId));
    onProgress?.(index + 1, files.length);
  }
  return urls;
}

export function productPayload(product) {
  const unlimited = Boolean(product.unlimited_stock);
  return {
    ...product,
    images: (product.images || []).filter(Boolean),
    base_cost: Math.max(0, Number(product.base_cost) || 0),
    selling_price: Math.max(0, Number(product.selling_price ?? product.base_price) || 0),
    base_price: Math.max(0, Number(product.selling_price ?? product.base_price) || 0),
    base_stock: unlimited ? 0 : Math.max(0, Number(product.base_stock) || 0),
    unlimited_stock: unlimited,
    variants: (product.variants || []).map((variant) => ({
      ...variant,
      price: Math.max(0, Number(variant.price) || 0),
      stock: variant.unlimited_stock ? 0 : Math.max(0, Number(variant.stock) || 0),
      unlimited_stock: Boolean(variant.unlimited_stock),
      image_url: variant.image_url || "",
    })),
    is_active: product.is_active !== false,
  };
}

export function getProductImages(product, variant) {
  const variantImage = variant?.image_url || variant?.imageUrl;
  return [...new Set([variantImage, ...(product?.images || []), product?.imageUrl].filter(Boolean))];
}
