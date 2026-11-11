# Ship viewer

The interactive line-diagram viewer for one ship, as a project of its own. Ship Docs created it from its ship template,
and writes the ship's data into it:

- `ship.json`: the ship's ID and name.
- `src/sections/<folder>/`: one folder per drawing, with its `section.json`, line diagram, manual (PDF) and
  `manual-data.json` (the section's data: the component records the Library reads from the manual). Add a
  `diagram.ts` and `data.json` there to make parts of the line diagram clickable (`defineDiagram` is in
  `@shipdocs/viewer-core/diagram`). An optional `Icon.tsx` (default-exporting a 20×20 SVG in `currentColor`) is the
  section's icon in the sidebar.
- `src/sections/<folder>/v1/`, `v2/`…: each version of the drawing's code, generated from its line diagram with AI
  when it's uploaded, one folder per generation: `Diagram2D.tsx` and `Diagram3D.tsx` (the 2D and 3D views; they use
  three.js through `@react-three/fiber`), `Icon.tsx`, and the geometry they draw (e.g. `schematic.ts`).
  `section.json`'s `codegenVersion` is the version the viewer shows. They can be live piping diagrams from the shared
  viewer: `PipelineView2D` and `PipelineView3D` (`@shipdocs/viewer-core/pipeline` and `/pipeline/3d`) draw a
  `definePipeline({...})` schematic with the Library objects it names and the section's `manual-data.json` (see
  child/README.md, "Piping diagrams"). Other shared parts are in `src/shared/schematic/`. They're ordinary code: edit
  them like any other file. Views written by hand can go directly in the section's folder instead.
- `codegen/`: Ship Docs' records of the ship's code generations. It's outside `src/`, so it isn't part of the build.
- `src/objects/<id>/`: one folder per object, with its `object.json`, 3D model and line diagram.

- `src/custom/`: this ship's **customizations**, UI and functionality for this ship only: its theme, labels, replaced
  or wrapped components, extra views and hooks (`src/custom/index.tsx`, see child/README.md). Made by people; code
  generation reads it but never changes it.

Everything else (the viewer's UI, how it reads this ship's data, and the Vite config) is `@shipdocs/viewer-core`, in
`child/core/`, which every ship shares. A change there reaches every ship the next time it's built, so there's nothing
to copy into ships; whatever `src/custom/` doesn't customize stays the shared viewer's.

```bash
npm run dev       # http://localhost:5173
npm run build     # a static site in dist/
npm run preview   # serves dist/
```

These use the child app's packages (`npm install` in `child/`), so the project needs no install of its own.

`dist/` uses relative URLs and needs nothing else, so it can be hosted at any path on any static file host. Inside Ship
Docs, the viewer runs embedded in the ship's Viewer tab and talks to it with `postMessage`
(`@shipdocs/viewer-core`'s `src/app/protocol.ts`). On its own, it shows its own header instead.
