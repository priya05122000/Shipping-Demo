import { useEffect, useEffectEvent, useReducer, type ReactNode } from "react";
import { isEmbedded, postToParent, useParentCommands } from "./bridge";
import { callHook, customViewMode, CustomViewHost, Slotted } from "./customized";
import type { SelectedItem } from "./protocol";
import type { ActionContext, CustomAction, CustomView, ShipLabels, ViewOption } from "../customization";
import { useShip } from "../ship";
import defaultLogo from "../shared/assets/logo.svg";
import {
  GeneratedView,
  ItemDetails,
  NoSections,
  SectionActions,
  SectionLayout,
  SectionNav,
  ShipHeader,
  ViewSwitcher,
} from "../shared/components";
import { SectionProvider, type Section } from "../shared/diagram";
import { ManualView } from "../shared/manual";
import { initialViewerState, viewerReducer, type ViewerState, type ViewMode } from "../shared/operations";
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
/** The last choice of 2D or 3D, kept across reloads. */
const VIEW_KEY = "ship-viewer:view";

function rememberedView(): "2d" | "3d" | null {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === "2d" || saved === "3d" ? saved : null;
  } catch {
    return null;
  }
}

function rememberView(view: ViewMode) {
  if (view !== "2d" && view !== "3d") return;
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Not remembered across reloads; the switch still works.
  }
}

/** The section the page's address names (#/<id>), when the viewer runs on its own; "" when it names none. */
function sectionFromHash(): string {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  } catch {
    return "";
  }
}

/**
 * The section in the address (on its own; inside the parent, the parent opens one), or the first; in the 2D or 3D
 * view last chosen, else 2D.
 */
function initialState(sections: Section[]): ViewerState {
  const linked = isEmbedded ? undefined : sections.find((section) => section.id === sectionFromHash());
  const first = linked ?? sections.at(0);
  return { ...initialViewerState(first?.id ?? ""), view: rememberedView() ?? "2d" };
}

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
 * The viewer (layer 1): the sidebar of sections beside the open section, with the ship's customizations (layer 2: its
 * components, views, actions, theme, labels and hooks, see ../customization.ts) applied to the ship's content (layer 3).
 * Every section is shown the same way: its line diagram (with any hotspots), its generated 2D and 3D views
 * (Diagram2D.tsx, Diagram3D.tsx, e.g. piping diagrams from ../pipeline), its objects and its manual. Its views get the
 * section, its manual-data.json and state they share through SectionProvider (../shared/diagram/context.tsx).
 */
export function App() {
  // A new value only when a dev hot update changes the ship's data or customizations (see ../ship.ts).
  const { ship, sections, customization } = useShip();
  const { components, hooks, labels, theme } = customization;
  const customViews = customization.views ?? NO_VIEWS;
  const customActions = customization.actions ?? NO_ACTIONS;
  const [state, dispatch] = useReducer(viewerReducer, sections, initialState);
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

  /**
   * A section chosen in the sidebar. On its own, the viewer opens it through the address (#/<id>), so a link opens it
   * and Back returns to the one before; inside the parent, which keeps its own ?section= link, it opens it directly.
   */
  function chooseSection(sectionId: string) {
    if (isEmbedded) openSection(sectionId);
    else window.location.hash = `#/${encodeURIComponent(sectionId)}`;
  }

  function selectItem(itemId: string | null) {
    if (!section) return;
    const item = toSelectedItem(section, itemId);
    dispatch({ type: "select-item", itemId });
    postToParent({ type: "item-selected", item });
    callHook("onItemSelect", () => hooks?.onItemSelect?.(item, section), undefined);
  }

  useParentCommands((command) => openSection(command.sectionId));

  // On its own: the address changed (a section chosen, a link, Back or Forward). No section in it is the first.
  const onAddressChange = useEffectEvent(() => {
    const id = sectionFromHash() || sections.at(0)?.id;
    if (id) openSection(id);
  });
  useEffect(() => {
    if (isEmbedded) return;
    const listener = () => onAddressChange();
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);

  // Escape clears the selection, in every view.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented && state.selectedItemId !== null) selectItem(null);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

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
    if (!option) return;
    dispatch({ type: "set-view", view: option.value });
    rememberView(option.value);
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
  const summary = section ? (callHook("sectionSummary", () => hooks?.sectionSummary?.(section, summarize(section)), undefined) ?? summarize(section)) : "";

  const controls: ReactNode = (
    <>
      {actionContext && <SectionActions actions={sectionActions} context={actionContext} call={callHook} />}
      <Slotted
        name="ViewSwitcher"
        custom={components?.ViewSwitcher}
        default={ViewSwitcher}
        props={{ options: options as ViewOption[], value: view, onChange: setView }}
      />
    </>
  );

  /** The section's view showing now. */
  function sectionView(current: Section): ReactNode {
    if (customView) {
      return (
        <CustomViewHost
          key={`${current.id}:${view}`}
          view={customView}
          props={{ ship, section: current, selectedId: state.selectedItemId, onSelect: selectItem }}
        />
      );
    }
    if (view === "manual") return <ManualView section={current} />;
    if (view === "3d") {
      return current.view3d ? (
        <GeneratedView
          key={`${current.id}:3d`}
          view={current.view3d}
          label="3D"
          icon={<CubeIcon className="size-6" />}
          selectedId={state.selectedItemId}
          onSelect={selectItem}
        />
      ) : (
        <View3D section={current} />
      );
    }
    if (!showsDrawing && current.view2d) {
      return (
        <GeneratedView
          key={`${current.id}:2d`}
          view={current.view2d}
          label="2D"
          icon={<DiagramIcon className="size-6" />}
          selectedId={state.selectedItemId}
          onSelect={selectItem}
        />
      );
    }
    return <View2D section={current} selectedId={state.selectedItemId} onSelect={selectItem} />;
  }

  return (
    <div data-ui="viewer" className="flex h-dvh flex-col bg-page text-ink">
      {/* Inside the parent, its header already identifies the app and the ship. */}
      {!isEmbedded && (
        <Slotted
          name="Header"
          custom={components?.Header}
          default={ShipHeader}
          props={{ ship, subtitle: labels?.subtitle ?? DEFAULT_SUBTITLE, logo: theme?.logo ?? defaultLogo }}
        />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr]">
        <Slotted
          name="SectionNav"
          custom={components?.SectionNav}
          default={SectionNav}
          props={{ sections, activeId: section?.id ?? "", onSelect: chooseSection }}
        />

        {!section ? (
          <main className="flex min-h-0 min-w-0 p-4">
            <Slotted name="NoSections" custom={components?.NoSections} default={NoSections} props={{ ship }} />
          </main>
        ) : (
          // Its views share the section's state (useSectionState) while they change, and start afresh in the next section.
          <SectionProvider key={section.id} section={section}>
            <SectionLayout title={section.title} summary={summary} controls={controls}>
              <main className="flex min-h-0 min-w-0 flex-col gap-4 p-4 lg:flex-row">
                <div data-ui="view-panel" className="min-h-64 flex-1 overflow-hidden rounded-xl border border-line bg-panel">
                  {sectionView(section)}
                </div>
                {/* Details only apply to hotspots, which come from the section's optional diagram.ts. */}
                {showsDrawing && section.image && section.diagram && (
                  <aside
                    aria-label="Component details"
                    aria-live="polite"
                    data-ui="item-details"
                    className="shrink-0 overflow-y-auto rounded-xl border border-line bg-panel lg:w-72"
                  >
                    <Slotted name="ItemDetails" custom={components?.ItemDetails} default={ItemDetails} props={{ section, item: selectedItem }} />
                  </aside>
                )}
              </main>
            </SectionLayout>
          </SectionProvider>
        )}
      </div>
    </div>
  );
}
