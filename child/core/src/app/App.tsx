import { useEffect, useEffectEvent, useReducer } from "react";
import { isEmbedded, postToParent, useParentCommands } from "./bridge";
import { callHook, customViewMode, CustomViewHost, Slotted } from "./customized";
import type { SelectedItem } from "./protocol";
import type { ActionContext, CustomAction, CustomView, ShipLabels, ViewOption } from "../customization";
import { useShip } from "../ship";
import defaultLogo from "../shared/assets/logo.svg";
import { GeneratedView, ItemDetails, NoSections, SectionActions, SectionNav, ShipHeader, ViewSwitcher } from "../shared/components";
import type { Section } from "../shared/diagram";
import { ManualView } from "../shared/manual";
import { initialViewerState, viewerReducer, type ViewMode } from "../shared/operations";
import { CubeIcon, DiagramIcon } from "../shared/ui";
import { View2D } from "../shared/view2d";
import { View3D } from "../shared/view3d";

const BUILT_IN_VIEWS = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
  { value: "drawing", label: "Drawing" },
  { value: "manual", label: "Manual" },
] as const satisfies readonly { value: ViewMode; label: string }[];

const DEFAULT_SUBTITLE = "Interactive line diagrams";
const NO_VIEWS: CustomView[] = [];
const NO_ACTIONS: CustomAction[] = [];

/** Whether one of the ship's views or actions is offered for the section (its `appliesTo`). */
function appliesTo(what: string, check: ((section: Section) => boolean) | undefined, section: Section): boolean {
  return callHook(`${what}'s appliesTo`, () => check?.(section) ?? true, false);
}

/**
 * The section's views: the built-in ones ("Drawing", the uploaded line diagram, is its own view only when 2D shows
 * generated code instead), with the ship's labels if it has any, then the ship's own views that apply to it.
 */
function viewOptions(section: Section | undefined, customViews: CustomView[], labels: ShipLabels["views"] | undefined) {
  const builtIn = BUILT_IN_VIEWS.filter(
    (option) => !section || option.value !== "drawing" || (section.view2d && section.image),
  ).map((option): { value: ViewMode; label: string } => ({ value: option.value, label: labels?.[option.value] ?? option.label }));
  const custom = section
    ? customViews
        .filter((view) => appliesTo(`"${view.label}" view`, view.appliesTo, section))
        .map((view) => ({ value: customViewMode(view) as ViewMode, label: view.label }))
    : [];
  return [...builtIn, ...custom];
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

/**
 * The viewer (layer 1), with the ship's customizations (layer 2: its components, views, theme, labels and hooks, see
 * ../customization.ts) applied to the ship's content (layer 3).
 */
export function App() {
  // A new value only when a dev hot update changes the ship's data or customizations (see ../ship.ts).
  const { ship, sections, customization } = useShip();
  const { components, hooks, labels, theme } = customization;
  const customViews = customization.views ?? NO_VIEWS;
  const customActions = customization.actions ?? NO_ACTIONS;
  const [state, dispatch] = useReducer(viewerReducer, sections.at(0)?.id ?? "", initialViewerState);
  const findSection = (id: string) => sections.find((candidate) => candidate.id === id);
  // Undefined only when the ship has no drawings.
  const section = findSection(state.sectionId) ?? sections.at(0);
  const selectedItem = section?.diagram?.items.find((item) => item.id === state.selectedItemId) ?? null;

  // Events go to the parent (and the ship's hooks) from these handlers, not from effects, so each is sent once per change.
  function openSection(sectionId: string) {
    const target = findSection(sectionId);
    if (sectionId === state.sectionId || !target) return;
    dispatch({ type: "open-section", sectionId });
    postToParent({ type: "section-changed", sectionId });
    callHook("onSectionOpen", () => hooks?.onSectionOpen?.(target), undefined);
  }

  function selectItem(itemId: string | null) {
    if (!section) return;
    const item = toSelectedItem(section, itemId);
    dispatch({ type: "select-item", itemId });
    postToParent({ type: "item-selected", item });
    callHook("onItemSelect", () => hooks?.onItemSelect?.(item, section), undefined);
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
  // `sections` is a new array only when a dev hot update changes the ship's data, so this normally runs once.
  // Hot updates keep this component's state, so re-announcing keeps the parent's list of drawings current.
  useEffect(() => announceReady(), [sections]);

  useEffect(() => {
    document.title = `${ship.name} · Ship Viewer`;
  }, [ship.name]);

  const options = viewOptions(section, customViews, labels?.views);
  // E.g. "Drawing" stays selected when the next section has no generated code, so it has no Drawing view.
  const view: ViewMode = options.some((option) => option.value === state.view) ? state.view : "2d";

  /** Shows a view by its value ("2d", "custom:maintenance"…), if the section offers it. */
  function setView(next: string) {
    const option = options.find((candidate) => candidate.value === next);
    if (option) dispatch({ type: "set-view", view: option.value });
  }

  /** For the ship's actions: a built-in view by its value, or one of the ship's own by its ID. */
  function showView(next: string) {
    const own = customViews.find((candidate) => candidate.id === next);
    setView(own ? customViewMode(own) : next);
  }

  const actionContext: ActionContext | null = section
    ? { ship, section, selectedId: state.selectedItemId, onSelect: selectItem, showView }
    : null;
  const sectionActions = section ? customActions.filter((action) => appliesTo(`"${action.label}" action`, action.appliesTo, section)) : [];
  const customView = customViews.find((candidate) => customViewMode(candidate) === view);
  // The uploaded line diagram, with any hotspots from diagram.ts, rather than a generated view.
  const showsDrawing = view === "drawing" || (view === "2d" && !section?.view2d);
  const summary = section && callHook("sectionSummary", () => hooks?.sectionSummary?.(section, summarize(section)), undefined);

  return (
    <div data-ui="viewer" className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      {/* Inside the parent, its header already identifies the app and the ship. */}
      {!isEmbedded && (
        <Slotted
          name="Header"
          custom={components?.Header}
          default={ShipHeader}
          props={{ ship, subtitle: labels?.subtitle ?? DEFAULT_SUBTITLE, logo: theme?.logo ?? defaultLogo }}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-3 md:w-56 md:border-r md:border-b-0">
          <Slotted
            name="SectionNav"
            custom={components?.SectionNav}
            default={SectionNav}
            props={{ sections, activeId: section?.id ?? "", onSelect: openSection }}
          />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
          {section ? (
            <>
              <div data-ui="section-toolbar" className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 data-ui="section-title" className="text-base font-semibold text-slate-900">
                    {section.title}
                  </h1>
                  <p data-ui="section-summary" className="text-sm text-slate-500">
                    {summary ?? summarize(section)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {actionContext && <SectionActions actions={sectionActions} context={actionContext} call={callHook} />}
                  <Slotted
                    name="ViewSwitcher"
                    custom={components?.ViewSwitcher}
                    default={ViewSwitcher}
                    props={{ options: options as ViewOption[], value: view, onChange: setView }}
                  />
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
                <div data-ui="view-panel" className="min-h-64 flex-1 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  {customView ? (
                    <CustomViewHost
                      key={`${section.id}:${view}`}
                      view={customView}
                      props={{ ship, section, selectedId: state.selectedItemId, onSelect: selectItem }}
                    />
                  ) : view === "manual" ? (
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
                    data-ui="item-details"
                    className="shrink-0 overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 lg:w-72"
                  >
                    <Slotted
                      name="ItemDetails"
                      custom={components?.ItemDetails}
                      default={ItemDetails}
                      props={{ section, item: selectedItem }}
                    />
                  </aside>
                )}
              </div>
            </>
          ) : (
            <Slotted name="NoSections" custom={components?.NoSections} default={NoSections} props={{ ship }} />
          )}
        </main>
      </div>
    </div>
  );
}
