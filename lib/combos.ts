export type ComboNestedProduct = {
  id: string;
  name: string;
  image_url?: string | null;
  stock: number;
  unlimited_stock: boolean;
  is_active: boolean;
};

export type ComboNestedItem = {
  quantity: number;
  product_id?: string;
  products: ComboNestedProduct | ComboNestedProduct[] | null;
};

export function comboProduct(value: ComboNestedItem["products"]) {
  return Array.isArray(value) ? value[0] : value;
}

export function comboMaxQuantity(items: ComboNestedItem[] | null | undefined) {
  if (!items?.length) return 0;
  let max = 99;
  for (const item of items) {
    const product = comboProduct(item.products);
    if (!product?.is_active) return 0;
    if (!product.unlimited_stock) {
      const perCombo = Math.max(1, Number(item.quantity));
      max = Math.min(max, Math.floor(Number(product.stock) / perCombo));
    }
  }
  return Math.max(0, Math.min(99, max));
}
