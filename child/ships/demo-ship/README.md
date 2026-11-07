# Ship viewer

The interactive line-diagram viewer for one ship, as a standalone React + Vite project. Ship Docs created it from its
ship template, and writes the ship's data into it:

- `ship.json`: the ship's ID and name.
- `src/sections/<folder>/`: one folder per drawing, with its `section.json`, line diagram, manual (PDF) and
  `manual-data.json`. Add a `diagram.ts` and `data.json` there to make parts of the line diagram clickable.
- `src/sections/<folder>/Diagram2D.tsx` and `Diagram3D.tsx`: the drawing's 2D and 3D views, generated from its line
  diagram with AI when it's uploaded (they use three.js through `@react-three/fiber`). Their shared parts are in
  `src/shared/schematic/`. They're ordinary code: edit them like any other file.
- `codegen/`: the generated code's history, kept by Ship Docs: each version of a section's generated files, and the
  ship's finished generations. It's outside `src/`, so it isn't part of the build.
- `src/objects/<id>/`: one folder per object, with its `object.json`, 3D model and line diagram.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # a static site in dist/
npm run preview   # serves dist/
```

`dist/` uses relative URLs, so it can be hosted at any path on any static file host. Inside Ship Docs, the viewer runs
embedded in the ship's Viewer tab and talks to it with `postMessage` (`src/app/protocol.ts`). On its own, it shows its own
header instead.
