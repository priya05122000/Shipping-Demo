import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-slate-800 to-slate-950 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_0_1px_rgb(2_6_23/0.9),0_2px_6px_-1px_rgb(2_6_23/0.35)] hover:from-slate-700 hover:to-slate-900 focus-visible:outline-indigo-600 disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none",
  secondary:
    "bg-white text-slate-700 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_1px_2px_rgb(15_23_42/0.08)] hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-indigo-600 disabled:text-slate-400",
  danger:
    "bg-linear-to-b from-red-500 to-red-600 text-white shadow-sm ring-1 ring-red-700/60 hover:from-red-500 hover:to-red-500 focus-visible:outline-red-600 disabled:opacity-50",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-indigo-600 disabled:text-slate-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-sm",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all focus-visible:outline-2 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
