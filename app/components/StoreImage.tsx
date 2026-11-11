"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { catalogImagePath } from "@/lib/catalog-image-url";

// Keep next/image sizing/lazy-loading. Remote catalog files use the bounded route,
// whose fetch honors the environment proxy; local files retain the Next optimizer.
export default function StoreImage(props: ImageProps) {
  const [failed, setFailed] = useState<ImageProps["src"] | null>(null);
  const src = failed === props.src ? "/images/products/placeholder.svg" : props.src;
  const file = typeof src === "string" ? catalogImagePath(src, process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
  return <Image {...props} src={src}
    loader={file ? ({ width }) => `/api/catalog-image?file=${encodeURIComponent(file)}&w=${Math.min(width, 1920)}` : props.loader}
    onError={(event) => { setFailed(props.src); props.onError?.(event); }} />;
}
