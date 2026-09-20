import Image from "next/image";
import Link from "next/link";

type CatalogCardProps = {
  href: string;
  name: string;
  imageUrl?: string | null;
  eyebrow: string;
  description: string;
};

export default function CatalogCard({
  href,
  name,
  imageUrl,
  eyebrow,
  description,
}: CatalogCardProps) {
  return (
    <Link
      href={href}
      className="card-hover surface group overflow-hidden rounded-3xl"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-violet-500/20 to-fuchsia-950/20">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 639px) 100vw, (max-width: 899px) 50vw, (max-width: 1199px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-4xl text-violet-300">
            ✦
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121017] via-transparent to-transparent" />
      </div>

      <div className="border-t border-white/[.06] p-5">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-400">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-lg font-black leading-tight">{name}</h2>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">
          {description}
        </p>
        <span className="mt-3 inline-block text-xs font-bold text-violet-400">
          Abrir catálogo →
        </span>
      </div>
    </Link>
  );
}
