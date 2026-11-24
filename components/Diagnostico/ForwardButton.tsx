import SavingIndicator from "@/components/Diagnostico/SavingIndicator";
import { LABEL_SAVING } from "@/lib/diagnostico/loading";

// Every text the button can show. All of them are laid out in one grid cell and the ones not shown
// are invisible, so the button keeps the width of the widest and never changes size.
const LABEL_NEXT = "Próxima";
const LABEL_FINISH = "Concluir";

/**
 * The forward button of the questionnaire on version 2 (loading feedback RF-02). While `saving` it
 * shows a spinner and "Salvando…" in place of its label; it stays disabled when `disabled` is set.
 * The hidden labels are `aria-hidden`, so only the text on display is read.
 */
export default function ForwardButton({
  label,
  saving,
  disabled,
  reduceMotion,
  onClick,
}: {
  label: string;
  saving: boolean;
  disabled: boolean;
  reduceMotion: boolean;
  onClick: () => void;
}) {
  const reserved = [LABEL_NEXT, LABEL_FINISH].filter((text) => text !== label);
  const cell = "col-start-1 row-start-1 flex items-center justify-center gap-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-saving={saving ? "true" : "false"}
      className="btn btn-accent text-sm font-semibold uppercase tracking-wider disabled:opacity-50"
    >
      <span className="grid">
        <span data-slot="label" aria-hidden={saving ? "true" : undefined} className={`${cell} ${saving ? "invisible" : ""}`}>
          {label}
        </span>
        {reserved.map((text) => (
          <span key={text} data-slot="reserved" aria-hidden="true" className={`${cell} invisible`}>
            {text}
          </span>
        ))}
        <span
          data-slot="saving"
          aria-hidden={saving ? undefined : "true"}
          className={`${cell} ${saving ? "" : "invisible"}`}
        >
          <SavingIndicator reduceMotion={reduceMotion} />
          {LABEL_SAVING}
        </span>
      </span>
    </button>
  );
}
