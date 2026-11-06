interface Option<Value extends string> {
  value: Value;
  label: string;
}

interface SegmentedControlProps<Value extends string> {
  label: string;
  options: readonly Option<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/** A row of mutually exclusive toggle buttons, styled like the parent's tab list. */
export function SegmentedControl<Value extends string>({ label, options, value, onChange }: SegmentedControlProps<Value>) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-1 rounded-lg bg-slate-200/60 p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              selected ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
