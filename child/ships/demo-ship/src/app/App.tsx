import { useEffect, useEffectEvent, useReducer } from "react";
import { isEmbedded, postToParent, useParentCommands } from "@/app/bridge";
import type { SelectedItem } from "@/app/protocol";
import { findSection, sections } from "@/sections";
import { ship } from "@/ship";
import logo from "@/shared/assets/logo.svg";
import { ItemDetails, SectionNav } from "@/shared/components";
import type { DiagramItem, Section } from "@/shared/diagram";
import { ManualView } from "@/shared/manual";
import { initialViewerState, viewerReducer, type ViewMode } from "@/shared/operations";
import { SegmentedControl } from "@/shared/ui";
import { View2D } from "@/shared/view2d";
import { View3D } from "@/shared/view3d";

const VIEW_OPTIONS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
  { value: "manual", label: "Manual" },
] as const satisfies readonly { value: ViewMode; label: string }[];

/** What the section holds, e.g. "Line diagram · Manual · 3 objects". */
function summarize(section: Section): string {
  const count = section.objects.length;
  return [
    section.image ? "Line diagram" : "No line diagram",
    section.manual ? "Manual" : "No manual",
    count === 0 ? "No objects" : `${count} object${count === 1 ? "" : "s"}`,
  ].join(" · ");
}

function toSelectedItem(item: DiagramItem | null | undefined, sectionId: string): SelectedItem | null {
  return item ? { id: item.id, label: item.label, sectionId } : null;
}

export function App() {
  const [state, dispatch] = useReducer(viewerReducer, sections.at(0)?.id ?? "", initialViewerState);
  // Undefined only when src/sections lists no drawings.
  const section = findSection(state.sectionId) ?? sections.at(0);
  const selectedItem = section?.diagram?.items.find((item) => item.id === state.selectedItemId) ?? null;

  // Events go to the parent from these handlers (not from effects) so each one is sent once per change.
  function openSection(sectionId: string) {
    if (sectionId === state.sectionId || !findSection(sectionId)) return;
    dispatch({ type: "open-section", sectionId });
    postToParent({ type: "section-changed", sectionId });
  }

  function selectItem(itemId: string | null) {
    if (!section) return;
    dispatch({ type: "select-item", itemId });
    const item = section.diagram?.items.find((i) => i.id === itemId);
    postToParent({ type: "item-selected", item: toSelectedItem(item, section.id) });
  }

  useParentCommands((command) => openSection(command.sectionId));

  const announceReady = useEffectEvent(() => {
    postToParent({
      type: "ready",
      shipId: ship.id,
      sections: sections.map(({ id, title }) => ({ id, title })),
      sectionId: section?.id ?? null,
      item: section ? toSelectedItem(selectedItem, section.id) : null,
    });
  });
  // `sections` is a new array only when a dev hot update re-runs src/sections, so this normally runs once.
  // Hot updates keep this component's state, so re-announcing keeps the parent's list of drawings current.
  useEffect(() => announceReady(), [sections]);

  useEffect(() => {
    document.title = `${ship.name} · Ship Viewer`;
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      {/* Inside the parent, its header already identifies the app and the ship. */}
      {!isEmbedded && (
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <img src={logo} alt="" className="size-8" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{ship.name}</p>
            <p className="text-xs text-slate-500">Interactive line diagrams</p>
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-3 md:w-56 md:border-r md:border-b-0">
          <SectionNav sections={sections} activeId={section?.id ?? ""} onSelect={openSection} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
          {section ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-slate-900">{section.title}</h1>
                  <p className="text-sm text-slate-500">{summarize(section)}</p>
                </div>
                <SegmentedControl
                  label="View"
                  options={VIEW_OPTIONS}
                  value={state.view}
                  onChange={(view) => dispatch({ type: "set-view", view })}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                <div className="min-h-64 flex-1 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  {state.view === "2d" ? (
                    <View2D section={section} selectedId={state.selectedItemId} onSelect={selectItem} />
                  ) : state.view === "3d" ? (
                    <View3D section={section} />
                  ) : (
                    <ManualView section={section} />
                  )}
                </div>
                {/* Details only apply to hotspots, which come from the section's optional diagram.ts. */}
                {state.view === "2d" && section.image && section.diagram && (
                  <aside
                    aria-label="Component details"
                    aria-live="polite"
                    className="shrink-0 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 lg:w-72"
                  >
                    <ItemDetails section={section} item={selectedItem} />
                  </aside>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
              No drawings yet. Add a section to {ship.name} in the Library, and it will show up here.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
