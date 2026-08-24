export function getProductImages(product, variant) {
  const variantImage = variant?.image_url || variant?.imageUrl;
  return [...new Set([variantImage, ...(product?.images || []), product?.imageUrl].filter(Boolean))];
}
