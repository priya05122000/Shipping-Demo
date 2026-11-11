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

/** A row of mutually exclusive toggle buttons: a pill, the selected one filled with the accent colour. */
export function SegmentedControl<Value extends string>({ label, options, value, onChange, ui }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} data-ui={ui} className="inline-flex rounded-full border border-line bg-panel-2 p-0.75">
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
            className={`cursor-pointer rounded-full px-3 py-1 text-[12px] font-[650] tracking-[0.4px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
