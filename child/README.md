# Ship viewers (the child app)

Every ship's interactive line-diagram viewer. It's an app of its own, separate from Ship Docs (the Next.js parent in
`..`): its own `package.json`, lockfile and `node_modules`, its own build, and its own deploy. Nothing here is part of
the parent's install, type check or build.

```
core/       @shipdocs/viewer-core: the viewer every ship runs (UI, data loading, message bridge, Vite config)
template/   what a new ship's folder is made from: the files below, without data
ships/      one project per ship
dist/       the built ships, one static site each (git-ignored)
```

## One viewer, every ship

A ship's project holds only that ship's data and generated code:

```
ships/<ship>/
  ship.json                  its ID and name (written by the Library)
  src/sections/<folder>/     one drawing each: section.json, line diagram, manual, generated Diagram2D/3D.tsx
  src/objects/<id>/          one object each: object.json, 3D model, line diagram, card.json
  src/shared/schematic/      components the ship's generated code shares
  codegen/                   the generated code's history (not built)
  src/main.tsx               mountShip(manifest): starts the shared viewer with this ship's data
  src/styles.css, src/env.d.ts, index.html, vite.config.ts, tsconfig*.json, package.json
```

Everything else is `core/`, which every ship imports, so **a change in `core/` reaches every ship the next time it's
built** (and at once, in the dev server). There's nothing to copy into ships. The ship's data reaches the viewer through
`virtual:ship-manifest`, a module that `core/vite.js` writes for each ship: its `import.meta.glob`s find that ship's
sections and objects, wherever the ship is.

Generated code imports the viewer as `@shipdocs/viewer-core/diagram` (`SectionViewProps`, `defineDiagram`),
`@shipdocs/viewer-core/objects` (`ObjectSymbol2D`, `objectPort`), `@shipdocs/viewer-core/objects/model3d`
(`ObjectModel3D`), `@shipdocs/viewer-core/catalog`, `/data` and `/ui`, and the ship's own components as
`@/shared/schematic/…`. Ship Docs' code generation reads `core/` but never changes it.

## Commands

```bash
npm install                 # once (from the parent: npm run install:child)
npm run dev                 # every ship at http://localhost:5173/child/<ship>/ (CHILD_DEV_PORT to change the port)
npm run typecheck           # this app's config and core/
npm run build               # every ship, each on its own, into dist/<ship>/
npm run build -- <ship>...  # only the named ships
npm run serve               # serves dist/ at http://localhost:4173/child/<ship>/, as a static host would
npm run migrate             # turns ships made before core/ (with their own copy of the viewer) into ones that use it
```

Each ship is type-checked and built on its own, with its own `vite.config.ts`. A ship that fails doesn't stop the
others and leaves no output; the command then exits with an error naming it. Inside a ship's folder, `npm run dev`,
`npm run build` and `npm run preview` work too, using this app's packages.

## Deploying

Each `dist/<ship>/` is a complete static site: the viewer, the ship's data, images and manuals, with relative URLs and
no client-side routes. Upload it to any static host, at any path, on its own; deploying one ship never touches another
ship or Ship Docs. Let the host cache `assets/` for good (their names carry a content hash).

Ship Docs shows a ship's viewer by proxying its own `/child/<ship>/` to `<SHIP_VIEWER_URL>/<ship>/` (set when the parent
is built), so the two talk with `postMessage` on one origin. So for Ship Docs, upload every `dist/<ship>/` under one base
URL and point `SHIP_VIEWER_URL` at it. On its own, a viewer shows its own header instead.

The messages between the two are `core/src/app/protocol.ts` here and `src/lib/viewer-protocol.ts` in the parent: change
both together, and keep changes backwards compatible, since ships and the parent are deployed separately.
