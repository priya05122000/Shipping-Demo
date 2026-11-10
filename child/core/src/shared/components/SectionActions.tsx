import type { ActionContext, CustomAction } from "../../customization";

const VARIANTS = {
  primary: "bg-accent-600 text-white shadow-sm hover:bg-accent-700 disabled:bg-slate-300",
  secondary: "bg-white text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 disabled:text-slate-400",
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
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed ${VARIANTS[variant]}`}
          >
            {action.icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
