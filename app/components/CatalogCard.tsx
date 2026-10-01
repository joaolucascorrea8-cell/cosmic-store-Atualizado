import Image from "next/image";
import Link from "next/link";
import Icon from "./Icon";
type Props = {
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
}: Props) {
  return (
    <Link
      href={href}
      className="game-tile group overflow-hidden rounded-2xl border border-white/10 bg-[#13131a]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#17151f]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw,33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <Icon
            name="gamepad"
            className="absolute inset-0 m-auto h-20 w-20 text-violet-400/40"
          />
        )}
      </div>
      <div className="p-5">
        <p className="eyebrow">{eyebrow}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight">{name}</h3>
          <Icon name="arrow" className="h-5 w-5 shrink-0 text-violet-300" />
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{description}</p>
      </div>
    </Link>
  );
}
