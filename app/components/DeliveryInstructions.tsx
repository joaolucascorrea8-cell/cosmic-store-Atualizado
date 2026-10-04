export type Instruction = { name: string; text: string };
export default function DeliveryInstructions({
  items,
}: {
  items: { delivery_instructions?: Instruction[] | null }[];
}) {
  const unique = [
    ...new Map(
      items
        .flatMap((i) => i.delivery_instructions ?? [])
        .filter((i) => i.text?.trim())
        .map((i) => [i.name + "|" + i.text, i]),
    ).values(),
  ];
  if (!unique.length) return null;
  return (
    <section className="my-5 rounded-2xl border border-violet-400/20 bg-violet-500/[.04] p-5">
      <h2 className="font-bold">Como receber seus itens</h2>
      <div className="mt-4 space-y-4">
        {unique.map((i, index) => (
          <div key={index}>
            <h3 className="text-sm font-bold text-violet-200">{i.name}</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
              {i.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
