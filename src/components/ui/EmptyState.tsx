import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-b from-white to-slate-50 text-slate-400 shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_1px_2px_rgb(15_23_42/0.08)]">
        {icon}
      </div>
      <h3 className="mt-5 text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
