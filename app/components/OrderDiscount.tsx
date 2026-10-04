import { money } from "@/lib/catalog";
export default function OrderDiscount({
  subtotal,
  discount,
  code,
}: {
  subtotal?: number | string | null;
  discount?: number | string | null;
  code?: string | null;
}) {
  if (!discount || Number(discount) <= 0) return null;
  return (
    <div className="my-4 space-y-2 border-t border-white/10 pt-4 text-sm">
      <div className="flex justify-between gap-3 text-zinc-400">
        <span>Subtotal</span>
        <span>{money(Number(subtotal))}</span>
      </div>
      <div className="flex justify-between gap-3 text-emerald-300">
        <span className="break-all">Cupom {code}</span>
        <strong className="shrink-0">− {money(Number(discount))}</strong>
      </div>
    </div>
  );
}
