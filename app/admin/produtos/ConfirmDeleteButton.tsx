"use client";

export default function ConfirmDeleteButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        const confirmed = window.confirm(
          "Tem certeza de que deseja excluir este produto? Esta ação não pode ser desfeita."
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
      className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
    >
      Excluir
    </button>
  );
}