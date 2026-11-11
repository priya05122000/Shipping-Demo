import { useState } from "react";
import type { SectionNavProps } from "../../customization";
import { FOCUS_RING_INSET } from "../../pipeline/components/ui";
import { DiagramIcon } from "../ui";

const COLLAPSED_KEY = "ship-viewer:sidebar-collapsed";

/** As the viewer's user left it, or collapsed on narrow screens. */
function initialCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY);
    if (saved !== null) return saved === "1";
  } catch {
    // Storage blocked: fall through to the default.
  }
  return window.innerWidth < 760;
}

/**
 * The sidebar of sections (the SectionNav slot's default). Collapsed, it shows only the icons (each section's Icon.tsx,
 * or a drawing); each name is then its tooltip. Nothing in it is re-laid out when it collapses: the icons and the
 * toggle sit where they are in both widths, and the names fade while the edge slides over them.
 */
export function SectionNav({ sections, activeId, onSelect }: SectionNavProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered across reloads; the toggle still works.
    }
  };

  // Collapsing, the names fade and are then hidden, so collapsed buttons are named by their title.
  const fade = collapsed
    ? "invisible opacity-0 [transition:opacity_250ms_var(--ease-slide),visibility_0s_250ms] motion-reduce:transition-none"
    : "transition-opacity duration-250 ease-slide motion-reduce:transition-none";

  return (
    <nav
      aria-label="Sections"
      data-ui="section-nav"
      data-collapsed={collapsed || undefined}
      className={`flex min-h-0 flex-col overflow-hidden border-r border-line bg-panel transition-[width] duration-250 ease-slide motion-reduce:transition-none ${collapsed ? "w-[60px]" : "w-[216px]"}`}
      data-layout-motion
    >
      <div className="relative flex min-h-[59px] flex-none items-center border-b border-line pl-5">
        <span data-ui="section-nav-heading" className={`text-[11px] font-[650] tracking-[0.8px] whitespace-nowrap text-muted uppercase ${fade}`}>
          Sections
        </span>
        {/* Kept 15px from the right edge, which is the middle of the collapsed bar. */}
        <button
          type="button"
          data-ui="section-nav-toggle"
          className={`absolute top-1/2 right-[15px] -mt-[15px] grid size-[30px] cursor-pointer place-items-center rounded-lg border border-line bg-panel-2 text-muted hover:text-ink ${FOCUS_RING_INSET}`}
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={`transition-transform duration-250 ease-slide motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2 py-2.5">
        {sections.map(({ id, title, Icon }) => {
          const active = id === activeId;
          return (
            <li key={id}>
              <button
                type="button"
                data-ui="section-nav-item"
                data-section={id}
                data-active={active || undefined}
                onClick={() => onSelect(id)}
                className={`relative flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left whitespace-nowrap ${FOCUS_RING_INSET} ${
                  active
                    ? "bg-accent text-on-accent before:absolute before:inset-y-2 before:-left-2 before:w-[3px] before:rounded-r-[3px] before:bg-accent"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? title : undefined}
              >
                {/* At 60px wide the icon's place (20px in) is the middle of the bar. */}
                <span className="grid size-5 flex-none place-items-center">{Icon ? <Icon /> : <DiagramIcon className="size-5" />}</span>
                <span className={`min-w-0 overflow-hidden text-ellipsis ${fade}`}>{title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
