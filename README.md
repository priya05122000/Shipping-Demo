# Ship Docs: Document & Diagram Management

A three-tab admin UI for **Line Diagrams**, **Objects** (3D model + line diagram) and **Manuals** (PDF).
Built with Next.js (App Router), TypeScript and Tailwind CSS. Records and uploaded files are saved to a **local `data/` folder** on the machine running the app. There's no database and no cloud.

```bash
npm install     # installs the parent and the child (npm workspace in ./child), and copies Monaco to public/monaco
npm run dev     # both apps: Next on http://localhost:3000, Vite (child) on :5173
npm run build   # builds the child into public/child, then the Next app
npm run lint
```

`npm run dev:parent` and `npm run dev:child` start one app at a time.

## Parent and child apps

The repo holds two apps:

- **Parent** (this folder): the Next.js admin, which owns the `/api` routes and the `data/` folder.
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

**Adding a drawing.** No drawings ship with the viewer yet. To add one, create a folder in `child/src/sections/` holding:
- `index.ts`: exports `defineSection({...})` (from `@/shared/diagram`)
- `diagram.ts`: hotspot rectangles in PNG pixels
- `data.json`: details per item ID
- `Icon.tsx`
- `line-diagram.png`

Then list the new folder in `child/src/sections/index.ts`.

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
data/
  line-diagrams.json     records + ID counter for each tab
  objects.json
  manuals.json
  uploads/
    line-diagrams/LD-001-image-9f2c1a7b.png
    objects/OBJ-001-model-3be0d14c.glb
    manuals/MAN-001-pdf-a1c2e3f4.pdf
```

- To back up or move the data, copy the `data/` folder. To start fresh, stop the server and delete it.
- `data/` is git-ignored.
- Set `SHIP_DATA_DIR` to store it somewhere else.
- **IDs:** `LD-001`, `OBJ-001`, `MAN-001`, generated separately per tab. The counter in each JSON file only increases, so IDs are never reused.
- **Writes:** each tab's writes are queued so two saves can't get the same ID. JSON files are replaced in one step, so a crash can't leave a half-written file.
- Replaced and deleted files are removed from `uploads/`.

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
| `GET /api/:collection` | List records (`line-diagrams`, `objects`, `manuals`) |
| `POST /api/:collection` | Create a record (multipart: `name` plus file fields) |
| `PUT /api/:collection/:id` | Update the name and/or replace files; omitted files are kept |
| `DELETE /api/:collection/:id` | Delete a record and its files |
| `GET /api/files/:collection/:file` | Serve an uploaded file |
| `GET /api/child-files` | The child app's files, as a tree (editor) |
| `GET /api/child-files/:path*` | Open a file: `{ path, content, version }` |
| `POST /api/child-files/:path*` | Create a file from JSON `{ content }`; 409 if it exists |
| `PUT /api/child-files/:path*` | Save JSON `{ content, version }`; 409 if the file changed since `version` |
| `DELETE /api/child-files/:path*` | Delete a file |

## Code map

| Path | Purpose |
| --- | --- |
| `src/types/records.ts` | `LineDiagram`, `ObjectRecord`, `Manual`, `StoredFile` interfaces |
| `src/lib/collection-defs.ts` | Per-tab ID prefix and file fields, shared by the UI and the server |
| `src/server/storage.ts` | Reads and writes the `data/` folder |
| `src/app/api/` | Route handlers for the API above |
| `src/lib/storage.ts` | Client-side store that calls the API and caches results |
| `src/components/records/` | Shared CRUD UI: table, add/edit form, view modal, tab panel |
| `src/components/ui/` | Reusable modal, confirm dialog, inputs, file upload, toasts, pagination |
| `src/app/viewer/`, `src/components/viewer/` | `/viewer` page and the iframe host that drives the child |
| `src/lib/viewer-bridge.ts`, `src/hooks/useViewerEvents.ts` | Parent side of the message bridge |
| `src/app/editor/`, `src/components/editor/` | `/editor` page: file tree, open-file tabs, Monaco |
| `src/server/child-files.ts` | Reads and writes `child/`, refusing anything outside it |
| `src/lib/child-files.ts`, `src/lib/child-files-api.ts` | Editor rules and types (shared), and the client for its API |
| `src/lib/monaco.ts`, `scripts/copy-monaco.mjs` | Loads Monaco from `public/monaco`, which is copied there on install |
| `child/src/app/` | Child shell, message bridge and protocol |
| `child/src/sections/` | One folder per drawing, plus the registry in `index.ts` |
| `child/src/shared/` | Child building blocks: `catalog`, `diagram`, `data`, `operations` (viewer state), `view2d`, `view3d`, `ui`, `components`, `assets` |
