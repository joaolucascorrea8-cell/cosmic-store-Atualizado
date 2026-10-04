"use client";
import { useState } from "react";
import { descriptionTemplates } from "@/lib/description-templates";
export default function DescriptionTemplateField({
  id,
  initial,
}: {
  id: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  return (
    <div data-live-dirty={text !== initial}>
      <label className="admin-label" htmlFor={`template-${id}`}>
        Modelo de descrição da categoria
      </label>
      <select
        aria-label="Sugestão de modelo"
        className="admin-input mb-2"
        value=""
        onChange={(e) => {
          const selected = descriptionTemplates.find(
            (t) => t.name === e.target.value,
          );
          if (
            selected &&
            (!text ||
              window.confirm("Substituir o modelo atual pela sugestão?"))
          )
            setText(selected.text);
        }}
      >
        <option value="">Partir de uma sugestão…</option>
        {descriptionTemplates.map((t) => (
          <option key={t.name}>{t.name}</option>
        ))}
      </select>
      <textarea
        id={`template-${id}`}
        name="description_template"
        rows={5}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="admin-input"
      />
      <p className="mt-1 text-xs leading-5 text-zinc-500">
        Use {"{{produto}}"} e {"{{jogo}}"} para preencher os nomes. O modelo
        fica disponível no editor de produtos; descrições já publicadas
        permanecem como estão.
      </p>
    </div>
  );
}
