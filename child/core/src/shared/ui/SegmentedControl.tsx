interface Option<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedControlProps<Value extends string> {
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /**
   * A styling hook for ships' CSS (see customization.ts): the group gets `data-ui="<ui>"`, and each button
   * `data-ui="<ui>-button"`, `data-value` and, when selected, `data-selected`.
   */
  ui?: string;
}

/** A row of mutually exclusive toggle buttons, styled like the parent's tab list. */
export function SegmentedControl<Value extends string>({ label, options, value, onChange, ui }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} data-ui={ui} className="inline-flex gap-1 rounded-lg bg-slate-200/60 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            data-ui={ui && `${ui}-button`}
            data-value={ui && option.value}
            data-selected={(ui && selected) || undefined}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-600 ${
              selected ? "bg-white text-accent-700 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
