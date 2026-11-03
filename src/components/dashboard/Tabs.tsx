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

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Record types"
        onKeyDown={onKeyDown}
        className="inline-flex min-w-full gap-1 rounded-xl bg-slate-200/60 p-1 sm:min-w-0"
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
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 sm:gap-2 sm:px-4 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-indigo-600 sm:flex-none ${
                selected ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              <Icon className="hidden size-4 sm:block" />
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums ${
                    selected ? "bg-indigo-100 text-indigo-700" : "bg-slate-300/60 text-slate-600"
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
