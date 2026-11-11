import type { ActionContext, CustomAction } from "../../customize/types";
import { FOCUS_RING } from "../../theme";

const VARIANTS = {
  primary: "border-accent bg-accent text-on-accent hover:opacity-90 disabled:opacity-50",
  secondary: "border-line bg-panel-2 text-ink hover:border-accent disabled:text-muted disabled:opacity-60 disabled:hover:border-line",
} as const;

interface SectionActionsProps {
  /** The ship's actions that apply to the section. */
  actions: CustomAction[];
  context: ActionContext;
  /** Runs one of the ship's functions, which mustn't break the viewer (see app/customized.tsx). */
  call: <T>(name: string, run: () => T, fallback: T) => T;
}

/** The ship's own buttons (its customizations' `actions`), in the section's toolbar. */
export function SectionActions({ actions, context, call }: SectionActionsProps) {
  if (actions.length === 0) return null;
  const { ship, section, selectedId } = context;
  return (
    <div data-ui="section-actions" className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const variant = action.variant ?? "secondary";
        const disabled = call(`"${action.label}" action's disabled`, () => action.disabled?.({ ship, section, selectedId }) ?? false, false);
        return (
          <button
            key={action.id}
            type="button"
            title={action.title}
            disabled={disabled}
            data-ui="action-button"
            data-action={action.id}
            data-variant={variant}
            onClick={() => call(`"${action.label}" action`, () => action.onClick(context), undefined)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-[550] transition-[border-color,color,opacity] duration-150 disabled:cursor-not-allowed ${FOCUS_RING} ${VARIANTS[variant]}`}
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
