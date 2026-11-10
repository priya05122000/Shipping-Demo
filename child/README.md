# Ship viewers (the child app)

Every ship's interactive line-diagram viewer. It's an app of its own, separate from Ship Docs (the Next.js parent in
`..`): its own `package.json`, lockfile and `node_modules`, its own build, and its own deploy. Nothing here is part of
the parent's install, type check or build.

```
core/       @shipdocs/viewer-core: the viewer every ship runs (layer 1)
template/   what a new ship's folder is made from: the files below, without data
ships/      one project per ship (layers 2 and 3)
dist/       the built ships, one static site each (git-ignored)
```

## Three layers

Each ship's viewer is built from three layers. A layer only adds to or changes the ones above it, and only through the
ways they offer, so each layer can change on its own:

| Layer | Where | What | Reaches | Changed by |
| --- | --- | --- | --- | --- |
| 1. Common | `core/` | The viewer: its UI, how it reads a ship's content, the message bridge, the Vite config | every ship | people |
| 2. Ship customization | `ships/<ship>/src/custom/` | UI and functionality for this ship only: theme, labels, replaced components, extra views, hooks | this ship | people |
| 3. Ship content | `ships/<ship>/` `ship.json`, `src/sections/`, `src/objects/`, `src/shared/schematic/`, `codegen/` | The ship's data and the code generated from its drawings | this ship | the Library and code generation |

- **A change in layer 1 reaches every ship** the next time it's built (and at once, in the dev server), customized or
  not: whatever a ship doesn't customize is the common viewer's, and a component a ship wraps gets the common one to
  wrap. There's nothing to copy into ships.
- **A change in layer 2 reaches that ship only**: its customizations are in its own folder, so they're only in its
  build.
- **Layer 3** is written by Ship Docs: the Library writes the data, and code generation writes the views (it reads
  layers 1 and 2 but never changes them).

A ship's folder also has a few small files that start the viewer, the same in every ship (from the template):
`src/main.tsx` (`mountShip(manifest)`), `src/styles.css`, `src/env.d.ts`, `index.html`, `vite.config.ts`,
`tsconfig*.json` and `package.json`. Its content and customizations reach the viewer through `virtual:ship-manifest`, a
module that `core/vite.js` writes for each ship: its `import.meta.glob`s find that ship's sections, objects and
`src/custom/index.tsx`, wherever the ship is.

## Customizing one ship (layer 2)

A ship's `src/custom/index.tsx` default-exports its customizations (the template's is empty). Every part is optional
and type-checked against the common viewer's extension points (`core/src/customization.ts`):

```tsx
import { defineShipCustomization, DocumentIcon, type CustomViewProps } from "@shipdocs/viewer-core/customize";
import logo from "./logo.svg";
import "./custom.css"; // this ship's own styles, e.g. for its buttons (see "Styling" below)

function Maintenance({ section, selectedId, onSelect }: CustomViewProps) {
  return (
    <div className="p-6 text-sm">
      Maintenance plan for {section.title} (selected: {selectedId ?? "none"})
      <button type="button" className="ml-2 text-accent-700" onClick={() => onSelect(null)}>
        Clear
      </button>
    </div>
  );
}

export default defineShipCustomization({
  // The accent colour (active and selected things, objects' selection outlines) and the logo.
  theme: { accent: "#0f766e", logo },
  // Text the viewer shows, including the view buttons' labels.
  labels: { subtitle: "Fuel and ballast systems", views: { "2d": "Schematic", manual: "Handbook" } },
  // Replace or wrap the viewer's components: each gets its usual props plus `Default`, the viewer's own.
  components: {
    Header: ({ Default, ...props }) => (
      <>
        <Default {...props} />
        <p className="bg-amber-100 px-4 py-1 text-xs">Class survey due in March</p>
      </>
    ),
    ViewSwitcher: ({ Default, ...props }) => (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Show</span>
        <Default {...props} />
      </div>
    ),
  },
  // Views of this ship's own, next to 2D, 3D and Manual (`appliesTo` limits them to some sections).
  views: [{ id: "maintenance", label: "Maintenance", component: Maintenance }],
  // Buttons of this ship's own, in the section's toolbar.
  actions: [
    { id: "handbook", label: "Open handbook", icon: <DocumentIcon className="size-4" />, onClick: ({ showView }) => showView("manual") },
    {
      id: "report",
      label: "Report defect",
      variant: "primary",
      disabled: ({ selectedId }) => selectedId === null,
      onClick: ({ section, selectedId }) => window.open(`mailto:fleet@example.com?subject=${section.id} ${selectedId}`),
    },
  ],
  // Functionality.
  hooks: {
    sections: (sections) => sections.filter((section) => !section.title.startsWith("Draft")),
    sectionSummary: (section, standard) => `${standard} · ${section.objects.length} tagged items`,
    onItemSelect: (item) => console.log("selected", item?.id),
  },
});
```

| Part | What it changes |
| --- | --- |
| `theme` | `accent`: a CSS hex, `rgb()` or `hsl()` colour, replacing the viewer's indigo (its shades are made from it; in code, the Tailwind classes `accent-50` to `accent-800`); `logo`: the header's and the browser tab's |
| `labels` | `subtitle`: the line under the ship's name; `views`: the view buttons' labels (`"2d"`, `"3d"`, `"drawing"`, `"manual"`) |
| `components` | `Header`, `SectionNav`, `ViewSwitcher` (the view buttons), `ItemDetails`, `NoSections`. One that throws falls back to the viewer's own, with the error in the console |
| `views` | `{ id, label, component, appliesTo? }`: `component` gets the ship, the section and the shared selection (`selectedId`, `onSelect`), like the 2D and 3D views. One that throws shows a message instead |
| `actions` | Buttons in the section's toolbar: `{ id, label, onClick, icon?, variant?: "primary" \| "secondary", title?, appliesTo?, disabled? }`. `onClick` gets the ship, the section, the selection (`selectedId`, `onSelect`) and `showView(view)`; `disabled` decides from the ship, section and selection. One that throws logs the error |
| `hooks` | `sections` (which drawings to offer, in which order; the parent's list follows), `sectionSummary`, `onSectionOpen`, `onItemSelect` |

### Styling (buttons and other UI) for one ship

CSS imported from a ship's `src/custom/` is in that ship's build only. The viewer marks its parts with `data-ui`
attributes, which stay put when its markup or classes change, so a ship's CSS can restyle them without replacing any
component. Plain rules (outside a CSS layer) win over the viewer's Tailwind classes:

```css
/* src/custom/custom.css: pill-shaped, upper-case view buttons, the selected one filled; square action buttons */
[data-ui="view-switcher-button"] { border-radius: 9999px; text-transform: uppercase; }
[data-ui="view-switcher-button"][data-selected] { background-color: var(--color-accent-600); color: white; }
[data-ui="action-button"] { border-radius: 0; }
[data-ui="action-button"][data-action="report"] { font-weight: 700; }
[data-ui="section-nav-item"][data-active] { box-shadow: inset 3px 0 var(--color-accent-600); }
```

| `data-ui` | Part | Also |
| --- | --- | --- |
| `viewer` | the whole viewer | |
| `header` | the header (standalone only) | |
| `section-nav`, `section-nav-heading`, `section-nav-item` | the list of drawings, its heading, each drawing's button | `data-section="<ID>"`, `data-active` |
| `section-toolbar`, `section-title`, `section-summary` | the row above the view, the section's title and summary | |
| `view-switcher`, `view-switcher-button` | the view buttons | `data-value` (`2d`, `3d`, `drawing`, `manual`, `custom:<id>`), `data-selected` |
| `section-actions`, `action-button` | the ship's own buttons (`actions`) | `data-action="<id>"`, `data-variant` |
| `view-panel` | the panel the view is shown in | |
| `item-details` | the hotspot details panel | |
| `no-sections` | the message when the ship has no drawings | |

The accent colour is `var(--color-accent-50)` to `var(--color-accent-800)` in CSS, and `accent-*` in Tailwind classes.

Put the components, styles, images and data the customizations use in `src/custom/` too. Import the viewer's building
blocks from `@shipdocs/viewer-core/customize` (`EmptyState`, `Badge`, `SegmentedControl`, the icons, `useShip`, and the
types). Something no extension point covers belongs in layer 1: add an extension point (or the feature) to `core/`, so
every ship can use it, rather than copying the viewer's code into a ship.

When changing `core/src/customization.ts`, keep it backwards compatible (add optional fields): every ship's
customizations are type-checked against it, and a ship whose customizations no longer fit fails its own build only.

## Commands

```bash
npm install                 # once (from the parent: npm run install:child)
npm run dev                 # every ship at http://localhost:5173/child/<ship>/ (CHILD_DEV_PORT to change the port)
npm run typecheck           # this app's config and core/
npm run build               # every ship, each on its own, into dist/<ship>/
npm run build -- <ship>...  # only the named ships
npm run serve               # serves dist/ at http://localhost:4173/child/<ship>/, as a static host would
npm run migrate             # turns ships made before core/ (with their own copy of the viewer) into ones that use it,
                            # and gives every ship without one the template's empty src/custom/
```

Each ship is type-checked and built on its own, with its own `vite.config.ts`. A ship that fails doesn't stop the
others and leaves no output; the command then exits with an error naming it. Inside a ship's folder, `npm run dev`,
`npm run build` and `npm run preview` work too, using this app's packages.

## Deploying

Each `dist/<ship>/` is a complete static site: the viewer, the ship's customizations and content, images and manuals,
with relative URLs and no client-side routes. Upload it to any static host, at any path, on its own; deploying one ship
never touches another ship or Ship Docs. Let the host cache `assets/` for good (their names carry a content hash).

Ship Docs shows a ship's viewer by proxying its own `/child/<ship>/` to `<SHIP_VIEWER_URL>/<ship>/` (set when the parent
is built), so the two talk with `postMessage` on one origin. So for Ship Docs, upload every `dist/<ship>/` under one base
URL and point `SHIP_VIEWER_URL` at it. On its own, a viewer shows its own header instead.

The messages between the two are `core/src/app/protocol.ts` here and `src/lib/viewer-protocol.ts` in the parent: change
both together, and keep changes backwards compatible, since ships and the parent are deployed separately.
