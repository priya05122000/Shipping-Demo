"use client";

import { useRef, type ComponentType, type KeyboardEvent, type SVGProps } from "react";

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number;
}

interface TabsProps<Id extends string> {
  tabs: TabItem<Id>[];
  activeId: Id;
  onChange: (id: Id) => void;
}

/** ARIA tablist with roving focus (Arrow/Home/End). Panels use id `panel-${id}` and `tab-${id}`. */
export function Tabs<Id extends string>({ tabs, activeId, onChange }: TabsProps<Id>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent) {
    const index = tabs.findIndex((t) => t.id === activeId);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  // Scrolls sideways on phones; the padding keeps the shadow from being clipped.
  return (
    <div className="-mx-4 -my-3 overflow-x-auto px-4 py-3 sm:mx-0 sm:my-0 sm:overflow-visible sm:px-0 sm:py-0">
      <div
        role="tablist"
        aria-label="Record types"
        onKeyDown={onKeyDown}
        className="inline-flex min-w-full gap-1 rounded-2xl bg-white p-1 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)] sm:min-w-0"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-600 sm:flex-none sm:gap-2 sm:px-5 ${
                selected ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="hidden size-4 sm:block" />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums ${
                    selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
