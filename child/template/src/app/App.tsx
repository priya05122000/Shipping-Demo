import { useEffect, useEffectEvent, useReducer } from "react";
import { isEmbedded, postToParent, useParentCommands } from "@/app/bridge";
import type { SelectedItem } from "@/app/protocol";
import { findSection, sections } from "@/sections";
import { ship } from "@/ship";
import logo from "@/shared/assets/logo.svg";
import { GeneratedView, ItemDetails, SectionNav } from "@/shared/components";
import type { Section } from "@/shared/diagram";
import { ManualView } from "@/shared/manual";
import { initialViewerState, viewerReducer, type ViewMode } from "@/shared/operations";
import { CubeIcon, DiagramIcon, SegmentedControl } from "@/shared/ui";
import { View2D } from "@/shared/view2d";
import { View3D } from "@/shared/view3d";

const ALL_VIEWS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
  { value: "drawing", label: "Drawing" },
  { value: "manual", label: "Manual" },
] as const satisfies readonly { value: ViewMode; label: string }[];

/** The section's views. "Drawing" (the uploaded line diagram) is its own view only when 2D shows generated code instead. */
function viewOptions(section: Section) {
  return ALL_VIEWS.filter((option) => option.value !== "drawing" || (section.view2d && section.image));
}

/** What the section holds, e.g. "Line diagram · Manual · 3 objects · 2D + 3D code v2". */
function summarize(section: Section): string {
  const count = section.objects.length;
  const code = [section.view2d && "2D", section.view3d && "3D"].filter(Boolean).join(" + ");
  return [
    section.image ? "Line diagram" : "No line diagram",
    section.manual ? "Manual" : "No manual",
    count === 0 ? "No objects" : `${count} object${count === 1 ? "" : "s"}`,
    code && `${code} code${section.codeVersion ? ` v${section.codeVersion}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A selection for the parent: a hotspot from diagram.ts, or a tag from the generated views. */
function toSelectedItem(section: Section, itemId: string | null): SelectedItem | null {
  if (!itemId) return null;
  const item = section.diagram?.items.find((i) => i.id === itemId);
  return { id: itemId, label: item?.label ?? itemId, sectionId: section.id };
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
    postToParent({ type: "item-selected", item: toSelectedItem(section, itemId) });
  }

  useParentCommands((command) => openSection(command.sectionId));

  const announceReady = useEffectEvent(() => {
    postToParent({
      type: "ready",
      shipId: ship.id,
      sections: sections.map(({ id, title }) => ({ id, title })),
      sectionId: section?.id ?? null,
      item: section ? toSelectedItem(section, state.selectedItemId) : null,
    });
  });
  // `sections` is a new array only when a dev hot update re-runs src/sections, so this normally runs once.
  // Hot updates keep this component's state, so re-announcing keeps the parent's list of drawings current.
  useEffect(() => announceReady(), [sections]);

  useEffect(() => {
    document.title = `${ship.name} · Ship Viewer`;
  }, []);

  const options = section ? viewOptions(section) : ALL_VIEWS;
  // E.g. "Drawing" stays selected when the next section has no generated code, so it has no Drawing view.
  const view: ViewMode = options.some((option) => option.value === state.view) ? state.view : "2d";
  // The uploaded line diagram, with any hotspots from diagram.ts, rather than a generated view.
  const showsDrawing = view === "drawing" || (view === "2d" && !section?.view2d);

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
                  options={options}
                  value={view}
                  onChange={(next) => dispatch({ type: "set-view", view: next })}
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                <div className="min-h-64 flex-1 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  {view === "manual" ? (
                    <ManualView section={section} />
                  ) : view === "3d" ? (
                    section.view3d ? (
                      <GeneratedView
                        key={`${section.id}:3d`}
                        view={section.view3d}
                        label="3D"
                        icon={<CubeIcon className="size-6" />}
                        selectedId={state.selectedItemId}
                        onSelect={selectItem}
                      />
                    ) : (
                      <View3D section={section} />
                    )
                  ) : !showsDrawing && section.view2d ? (
                    <GeneratedView
                      key={`${section.id}:2d`}
                      view={section.view2d}
                      label="2D"
                      icon={<DiagramIcon className="size-6" />}
                      selectedId={state.selectedItemId}
                      onSelect={selectItem}
                    />
                  ) : (
                    <View2D section={section} selectedId={state.selectedItemId} onSelect={selectItem} />
                  )}
                </div>
                {/* Details only apply to hotspots, which come from the section's optional diagram.ts. */}
                {showsDrawing && section.image && section.diagram && (
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
