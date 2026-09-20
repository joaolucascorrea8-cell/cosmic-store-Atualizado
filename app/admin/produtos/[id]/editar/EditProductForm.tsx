"use client";

import {
  updateProduct,
  type UpdateProductState,
} from "@/app/admin/actions";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import ProductImageUpload from "../../ProductImageUpload";

type EditableProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  unlimited_stock: boolean;
  image_url: string | null;
  is_active: boolean;
};

type EditProductFormProps = {
  product: EditableProduct;
};

function SaveButton() {
 const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Salvando..." : "Salvar alterações"}
    </button>
  );
}

export default function EditProductForm({
  product,
}: EditProductFormProps) {  
  const initialState: UpdateProductState = {
  error: null,
};

const [state, formAction] = useActionState(
  updateProduct,
  initialState
);

const [unlimitedStock, setUnlimitedStock] = useState(
  product.unlimited_stock
);

  return (
  <form action={formAction}>
    <input
      type="hidden"
      name="product_id"
      value={product.id}
    />
{state.error && (
  <div
    role="alert"
    className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
  >
    {state.error}
  </div>
)}


    <div>
  <label
    htmlFor="product_name"
    className="mb-2 block text-sm text-gray-300"
  >
    Nome do produto
  </label>

  <input
    id="product_name"
    name="name"
    type="text"
    defaultValue={product.name}
    minLength={2}
    maxLength={100}
    required
    className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  />
</div>

<div className="mt-5">
  <label
    htmlFor="product_slug"
    className="mb-2 block text-sm text-gray-300"
  >
    Slug do produto
  </label>

  <input
    id="product_slug"
    name="slug"
    type="text"
    defaultValue={product.slug}
    minLength={2}
    maxLength={100}
    pattern="[a-z0-9]+(-[a-z0-9]+)*"
    required
    className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  />

  <p className="mt-2 text-xs text-gray-500">
    Use apenas letras minúsculas, números e hífens. Exemplo: perm-dragon.
  </p>
</div>

<div className="mt-5">
  <label
    htmlFor="product_description"
    className="mb-2 block text-sm text-gray-300"
  >
    Descrição do produto
  </label>

  <textarea
    id="product_description"
    name="description"
    defaultValue={product.description ?? ""}
    maxLength={2000}
    rows={5}
    placeholder="Digite a descrição do produto..."
    className="w-full resize-y rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  />
</div>

<div className="mt-5">
  <p className="mb-2 block text-sm text-gray-300">
    Imagem do produto
  </p>
  <ProductImageUpload
    inputId="product_image_url"
    defaultValue={product.image_url}
  />
</div>

<div className="mt-5">
  <label
    htmlFor="product_price"
    className="mb-2 block text-sm text-gray-300"
  >
    Preço (R$)
  </label>

  <input
    id="product_price"
    name="price"
    type="number"
    defaultValue={product.price}
    min="0"
    max="9999999999.99"
    step="0.01"
    required
    className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  />
</div>

<div className="mt-5">
  <label
    htmlFor="product_stock"
    className="mb-2 block text-sm text-gray-300"
  >
    Estoque
  </label>

  <input
    id="product_stock"
    name="stock"
    type="number"
    defaultValue={product.stock}
    min="0"
    max="2147483647"
    step="1"
    required
    className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  />

  {unlimitedStock && (
    <p className="mt-2 text-sm text-purple-300">
      Este produto possui estoque ilimitado. O valor acima não limita as vendas.
    </p>
  )}
</div>

<div className="mt-5">
  <label
    htmlFor="product_unlimited_stock"
    className="mb-2 block text-sm text-gray-300"
  >
    Tipo de estoque
  </label>

  <select
  id="product_unlimited_stock"
  name="unlimited_stock"
  value={unlimitedStock ? "true" : "false"}
  onChange={(event) => setUnlimitedStock(event.target.value === "true")}
  className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
>
    <option value="false">Estoque limitado</option>
    <option value="true">Estoque ilimitado</option>
  </select>
</div>

<div className="mt-5">
  <label
    htmlFor="product_is_active"
    className="mb-2 block text-sm text-gray-300"
  >
    Status do produto
  </label>

  <select
    id="product_is_active"
    name="is_active"
    defaultValue={product.is_active ? "true" : "false"}
    className="w-full rounded-lg border border-purple-500/20 bg-[#080812] px-4 py-3 text-white outline-none focus:border-purple-400"
  >
    <option value="true">Ativo</option>
    <option value="false">Inativo</option>
  </select>
</div>

<div className="mt-8 flex justify-end">
  <SaveButton />
</div>

  </form>
);
}
