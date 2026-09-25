import Image from "next/image";

type ArtworkProduct = {
  id?: string;
  name: string;
  image_url: string | null;
};

export default function ComboArtwork({
  products,
  comboName,
  className = "",
}: {
  products: ArtworkProduct[];
  comboName: string;
  className?: string;
}) {
  const visible = products.filter((product) => product.image_url).slice(0, 4);
  const extra = Math.max(0, products.length - 4);

  if (!visible.length) {
    return <div className={`grid h-full w-full place-items-center bg-violet-500/[.06] ${className}`}><span className="text-4xl text-violet-300">✦</span></div>;
  }

  if (visible.length === 1) {
    return <div className={`relative h-full w-full ${className}`}><Image src={visible[0].image_url!} alt={comboName} fill sizes="(max-width:600px) 50vw, 25vw" className="object-contain p-5" /></div>;
  }

  const gridClass = visible.length === 2 ? "grid-cols-2" : visible.length === 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-2";

  return <div className={`grid h-full w-full gap-1.5 p-2 ${gridClass} ${className}`}>
    {visible.map((product, index) => {
      const spanClass = visible.length === 3 && index === 0 ? "row-span-2" : "";
      return <div key={product.id ?? `${product.name}-${index}`} className={`relative min-h-0 overflow-hidden rounded-xl bg-black/15 ${spanClass}`}>
        <Image src={product.image_url!} alt={product.name} fill sizes="160px" className="object-contain p-2" />
        {index === 3 && extra > 0 && <span className="absolute inset-0 grid place-items-center bg-black/65 text-lg font-black text-white">+{extra}</span>}
      </div>;
    })}
  </div>;
}
