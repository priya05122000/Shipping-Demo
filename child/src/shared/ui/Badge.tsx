import type { ReactNode } from "react";

/** Small pill. `color` tints the text and background; defaults to slate. */
export function Badge({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
      style={color ? { color, backgroundColor: `color-mix(in srgb, ${color} 12%, white)` } : undefined}
    >
      {children}
    </span>
  );
}
