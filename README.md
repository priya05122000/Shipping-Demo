# Ship Docs: Document & Diagram Management

An admin UI for **Sections** and **Objects**:

- A **section** is one drawing. It holds **one line diagram**, **one manual** (PDF), and the objects it uses.
- An **object** (3D model + line diagram) is **shared**, so any section can use it.

Built with Next.js (App Router), TypeScript and Tailwind CSS. Sections and objects are saved as **folders inside the child app** (`child/`) on the machine running the app, so the viewer can show them. There's no database and no cloud.

```bash
npm install     # installs the parent and the child (npm workspace in ./child), and copies Monaco to public/monaco
npm run dev     # both apps: Next on http://localhost:3000, Vite (child) on :5173
npm run build   # builds the child into public/child, then the Next app
npm run lint
```

`npm run dev:parent` and `npm run dev:child` start one app at a time.

## Parent and child apps

The repo holds two apps:

- **Parent** (this folder): the Next.js admin, which owns the `/api` routes and saves sections and objects into the child.
- **Child** (`child/`): a React + Vite **viewer** for interactive line diagrams.

The parent shows the child on `/viewer` in an `<iframe>`. Both are served from the same origin under `/child`:

| Mode | How `/child/*` is served |
| --- | --- |
| `npm run dev` | Next rewrites `/child/*` to the Vite dev server (`CHILD_DEV_URL`, default `http://localhost:5173`). Vite's hot reload connects to `:5173` directly. |
| `npm run build` / `start` | Vite builds into `public/child/` (git-ignored), and Next serves it as static files. No Vite process is needed. |

The child also runs on its own at `/child/index.html`, or at `http://localhost:5173/child/` in dev.

**Messages.** The two apps talk only through `postMessage`. The contract is `child/src/app/protocol.ts`, a types-only file that the parent imports as `@child/protocol`.

- Parent → child: `open-section`
- Child → parent: `ready` (the full viewer state, re-sent after reloads and hot updates), `section-changed` and `item-selected`

Both sides ignore messages from any other window or origin. The parent keeps the open drawing in `/viewer?section=<id>`.

**Adding a drawing.** Add a section in the Library (`/`). That creates its folder in `child/src/sections/`, and the viewer finds it on its own (`import.meta.glob` in `child/src/sections/index.ts`). While `npm run dev` runs, the viewer updates as soon as a section or object is saved. After `npm run build`, rebuild to see changes.

The viewer shows a section's line diagram (**2D**), its objects (**3D**; rendering the models is still to come) and its **Manual**. To make parts of a line diagram clickable, add two files to the section's folder, e.g. in the editor:
- `diagram.ts`: `export default defineDiagram({ width, height, items })` (from `@/shared/diagram`). `width`/`height` are the image's pixel size; each item is a hotspot rectangle in those pixels.
- `data.json`: `{ "items": { "<item id>": { "description": "…", "specs": { "Label": "Value" } } } }`

## Editor

`/editor` edits the child app's source in the browser with [Monaco](https://microsoft.github.io/monaco-editor/), the editor behind VS Code.

- **Only `child/` is reachable.** The file tree and the API see nothing outside it, and never show or touch `node_modules` or `.git`. Paths are checked name by name, and each path's real location (after symlinks and junctions) must be inside `child/`.
- **Saving:** Ctrl/Cmd+S or **Save**. While `npm run dev` runs, Vite reloads the viewer as soon as a file is saved. After `npm run build`, rebuild to see changes.
- **Changed on disk:** if a file was changed elsewhere (e.g. in an IDE) since it was opened, the save is refused, and you choose between loading the disk version and overwriting it.
- **New file** creates any missing folders. **Delete** removes the open file, and any folders that leaves empty.
- Text files (UTF-8) up to 1 MB. Images and other binary files are listed but can't be opened.
- Monaco's files are copied from `node_modules/monaco-editor` to `public/monaco/` (git-ignored) by `scripts/copy-monaco.mjs` after `npm install`, so no CDN is used. If the editor says it couldn't load, run `npm install` again.
- **No sign-in.** Like the rest of the API, the editor trusts anyone who can reach the server, and it can change the child's code (including `vite.config.ts`, which Vite runs). Writes from other websites open in the browser are refused, but other machines on your network aren't blocked. To keep the dev server private, run it as `next dev -H 127.0.0.1`.

## Where data is stored

```
child/src/sections/
  next-id.json                     ID counter for sections
  engine-room/                     one folder per section, named from its name when created
    section.json                   its ID (SEC-001), name, dates, files, and the IDs of the objects it uses
    lineDiagram-9f2c1a7b.png       its line diagram (at most one)
    manual-a1c2e3f4.pdf            its manual (at most one)
    diagram.ts, data.json          optional hotspots, written by hand
child/src/shared/objects/
  next-id.json                     ID counter for objects
  OBJ-001/
    object.json                    name, dates and files
    model-3be0d14c.glb
    lineDiagram-77aa01ff.png
```

- Everything is a normal file in the child app, so it shows up in the editor and in `git status`. Commit it to share it, or add the folders to `.gitignore` to keep it local.
- **IDs:** each section gets a unique ID when it's created (`SEC-001`, `SEC-002`…), and each object too (`OBJ-001`…). Each collection's counter only increases, so IDs are never reused, even after a delete. The ID is used in the API and in viewer links (`/viewer?section=SEC-001`).
- **Section folders** are made from the name when the section is created: "Engine Room" becomes `engine-room`, and its ID is saved in `section.json`. Renaming a section changes only its name; the ID and folder stay. Two sections can't have names that make the same folder.
- **Object folders** are named after the object's ID.
- A section's line diagram and manual are optional, and either can be replaced or removed later. An object needs both of its files.
- An object can't be deleted while a section uses it. Remove it from those sections first.
- Deleting a section deletes its whole folder, including any files you added there in the editor.
- **Writes:** each collection's writes are queued, so two saves can't get the same ID. Each metadata file is replaced in one step and written after the files it lists, so the viewer never sees a half-saved record.
- Replaced and removed files are deleted from the record's folder.
- A metadata file that can't be read (e.g. after a bad hand edit) is skipped by the Library, with a warning in the server log.

## Upload rules (checked in the browser and again on the server)

| Field | Formats | Max size |
| --- | --- | --- |
| Line diagram / image | JPG, JPEG, PNG, WEBP, SVG | 2 MB |
| 3D diagram | GLB, GLTF, OBJ, FBX, STL, BLEND | 2 MB |
| Manual | PDF | 5 MB |

The limits are `MAX_FILE_SIZE` and `MAX_PDF_SIZE` in `src/lib/files.ts`.

## API (local only)

| Method & path | Purpose |
| --- | --- |
| `GET /api/:collection` | List records (`sections`, `objects`) |
| `POST /api/:collection` | Create a record (multipart: `name`, file fields, and for sections one `objectIds` value per object) |
| `PUT /api/:collection/:id` (e.g. `/api/sections/SEC-001`) | Update the name and/or replace files; omitted files are kept, `remove=<field>` clears an optional one. `objectIds` replaces the section's list (send none to clear it) |
| `DELETE /api/:collection/:id` | Delete a record's folder; 409 for an object a section still uses |
| `GET /api/files/:collection/:folder/:file` | Serve a file from a record's folder |
| `GET /api/child-files` | The child app's files, as a tree (editor) |
| `GET /api/child-files/:path*` | Open a file: `{ path, content, version }` |
| `POST /api/child-files/:path*` | Create a file from JSON `{ content }`; 409 if it exists |
| `PUT /api/child-files/:path*` | Save JSON `{ content, version }`; 409 if the file changed since `version` |
| `DELETE /api/child-files/:path*` | Delete a file |

## Code map

| Path | Purpose |
| --- | --- |
| `src/types/records.ts` | `Section`, `ObjectRecord`, `StoredFile` interfaces |
| `src/lib/collection-defs.ts` | Per-collection folder, IDs, file fields and links, shared by the UI and the server |
| `src/server/storage.ts` | Reads and writes section and object folders in the child app |
| `src/app/api/` | Route handlers for the API above |
| `src/lib/storage.ts` | Client-side store that calls the API and caches results |
| `src/components/records/` | Shared CRUD UI: table, add/edit form (with the object picker), view modal, tab panel |
| `src/components/ui/` | Reusable modal, confirm dialog, inputs, file upload, toasts, pagination |
| `src/app/viewer/`, `src/components/viewer/` | `/viewer` page and the iframe host that drives the child |
| `src/lib/viewer-bridge.ts`, `src/hooks/useViewerEvents.ts` | Parent side of the message bridge |
| `src/app/editor/`, `src/components/editor/` | `/editor` page: file tree, open-file tabs, Monaco |
| `src/server/child-files.ts`, `src/server/child-dir.ts` | Reads and writes `child/` for the editor, refusing anything outside it; shared helpers |
| `src/lib/child-files.ts`, `src/lib/child-files-api.ts` | Editor rules and types (shared), and the client for its API |
| `src/lib/monaco.ts`, `scripts/copy-monaco.mjs` | Loads Monaco from `public/monaco`, which is copied there on install |
| `child/src/app/` | Child shell, message bridge and protocol |
| `child/src/sections/` | One folder per section, plus the registry in `index.ts` that finds them |
| `child/src/shared/objects/` | One folder per shared object, plus the registry in `index.ts` |
| `child/src/shared/` | Child building blocks: `catalog`, `diagram`, `data`, `records` (reads Library folders), `operations` (viewer state), `view2d`, `view3d`, `manual`, `ui`, `components`, `assets` |
