# Ship Docs: Document & Diagram Management

An admin UI for **Ships**, each with its own **Sections** and **Objects**:

- A **ship** is one project: a **standalone React + Vite viewer project** of its own, which can be built and deployed on its own. It has a name and, optionally, an IMO number, a vessel type and a description. Everything else belongs to one ship.
- A **section** is one drawing of a ship. It holds **one line diagram**, **one manual** (PDF), and the objects it uses.
- An **object** (3D model + line diagram) is **shared** within its ship, so any of that ship's sections can use it.

Built with Next.js (App Router), TypeScript and Tailwind CSS. Each ship's sections and objects are saved as **folders inside the ship's own project** (`child/ships/<ship>/`) on the machine running the app, so its viewer can show them. There's no database and no cloud.

Uploading a section's line diagram also **generates React code** for it with AI: an interactive 2D view and a 3D view, written into the ship's project (see [Generated 2D and 3D code](#generated-2d-and-3d-code)). Set `ANTHROPIC_API_KEY` in `.env.local` for that.

```bash
npm install     # installs the parent and the child toolchain (npm workspace in ./child), and copies Monaco to public/monaco
npm run dev     # both apps: Next on http://localhost:3000, Vite (every ship's viewer) on :5173
npm run build   # builds every ship into public/child/<ship>/, then the Next app
npm run build:standalone                # builds every ship on its own, into child/ships/<ship>/dist/, to host separately
npm run build:standalone -- mv-aurora   # only the named ships (folder names in child/ships)
npm run lint
```

`npm run dev:parent` and `npm run dev:child` start one app at a time.

## Parent and child apps

The repo holds two apps:

- **Parent** (this folder): the Next.js admin, which owns the `/api` routes and saves ships, sections and objects into the child.
- **Child** (`child/`): the ships' **viewers** for interactive line diagrams:
  - `child/template/`: the viewer project. Creating a ship copies it to `child/ships/<ship>/`.
  - `child/ships/<ship>/`: one **standalone project per ship** (its own `package.json`, `vite.config.ts`, `index.html` and `src/`), holding that ship's data. Each ship's code is its own copy: changing the template changes only ships created afterwards, and a ship's code can be changed on its own.
  - `child/vite.config.ts`, `child/build-ships.mjs`: the shared toolchain. In development, one Vite server serves every ship. `npm run build` and `npm run build:standalone` build each ship with its own `vite.config.ts`.

| Page | What it shows |
| --- | --- |
| `/` | **Projects**: a card per ship, with **New ship**, edit and delete |
| `/projects/:id` | The ship's **Library**: its Sections and Objects tabs |
| `/projects/:id/viewer` | The child for that ship, in an `<iframe>` |
| `/projects/:id/editor` | The editor, showing only the ship's project folder |
| `/editor` | The editor for the child folder's shared files: the template, the dev server and build scripts (not the ships) |

Both apps are served from the same origin, each ship's viewer at `/child/<ship>/index.html`:

| Mode | How `/child/*` is served |
| --- | --- |
| `npm run dev` | Next rewrites `/child/*` to the Vite dev server (`CHILD_DEV_URL`, default `http://localhost:5173`), which serves every ship in `child/ships`. A new ship works straight away. Vite's hot reload connects to `:5173` directly. |
| `npm run build` / `start` | Each ship is type-checked and built into `public/child/<ship>/` (git-ignored), and Next serves them as static files. No Vite process is needed. A ship added after the build shows "isn't built yet" until the next build. |

Each viewer also runs on its own at the same URL, with its own header.

**Hosting a ship on its own (production).** Run `npm run build:standalone` to build every ship, or `npm run build:standalone -- <ship>` (e.g. `-- mv-aurora`, or several names) for only some. Each ship becomes a static site in its own `child/ships/<ship>/dist/`. Upload that folder's contents to any static file host (Netlify, Vercel, S3/CloudFront, Nginx, GitHub Pages…), one site per ship. It needs no server or API: the ship's sections, objects, images and manuals are all bundled into it. It uses relative URLs, so it works at any path, and it has one page and no client-side routes, so no rewrite rules are needed. No `npm install` is needed per ship: the build uses the child toolchain in `child/node_modules`, and type-checks the ship first. `dist/` is in each ship's `.gitignore`. Rebuild after changing a ship in the Library or editor; a ship's site only shows what was in its folder when it was built.

To build a ship outside this repo instead, copy its folder (`child/ships/<ship>/`, without `node_modules` and `dist`) anywhere, then run `npm install` and `npm run build` there. Each ship's own `README.md` says the same.

When hosted on its own, a viewer shows its own header and drawing list. It doesn't work as a cross-origin embed: the message bridge only talks to a parent on the same origin, so Ship Docs embeds its viewers from its own `/child/<ship>/`.

**Messages.** The apps talk only through `postMessage`. The contract is `src/app/protocol.ts` in each ship, a types-only file. The parent imports the template's copy as `@child/protocol`.

- Parent → child: `open-section`
- Child → parent: `ready` (the full viewer state, re-sent after reloads and hot updates), `section-changed` and `item-selected`

`ready` includes `shipId`, from the project's `ship.json`; the parent checks that it's the ship it opened. Both sides ignore messages from any other window or origin. The parent keeps the open drawing in `/projects/<ship>/viewer?section=<id>`.

**Adding a drawing.** Add a ship on the Projects page (`/`), open it, and add a section in its Library. That creates the section's folder in `child/ships/<ship>/src/sections/`, and the ship's viewer finds it on its own (`import.meta.glob` in its `src/sections/index.ts`). While `npm run dev` runs, the viewer updates as soon as a section or object is saved. After `npm run build`, rebuild to see changes.

The viewer shows a section's line diagram (**2D**), its objects (**3D**; rendering the models is still to come) and its **Manual**. Once a section has [generated code](#generated-2d-and-3d-code), **2D** and **3D** show that instead, and the uploaded line diagram moves to its own **Drawing** view. To make parts of a line diagram clickable, add two files to the section's folder, e.g. in the editor:
- `diagram.ts`: `export default defineDiagram({ width, height, items })` (from `@/shared/diagram`). `width`/`height` are the image's pixel size; each item is a hotspot rectangle in those pixels.
- `data.json`: `{ "items": { "<item id>": { "description": "…", "specs": { "Label": "Value" } } } }`

## Generated 2D and 3D code

When a section's line diagram is uploaded (with a new section, or replacing one), the parent turns it into React code with the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview): Claude looks at the drawing and writes the code into the ship's project, where the ship's viewer shows it.

- **What's written:** the section's `Diagram2D.tsx` (SVG) and `Diagram3D.tsx` ([react-three-fiber](https://r3f.docs.pmnd.rs/)) in its folder, plus the ship's **shared schematic components** in `src/shared/schematic/` (one 2D and one 3D component per kind of equipment, pipes, and the types that describe a drawing), which every section's code uses. It's ordinary code: change it in the editor like any other file.
- **Two prompts**, in `src/server/codegen/prompts/` (Markdown, read again for each generation, so edits apply straight away):
  - `first.md` for a ship's **first** generation: creates the shared components, simply.
  - `second.md` for **every later** generation of the ship: reuses the shared components, adding to them only in ways that keep the other sections working.
  - `rules.md` goes with both: where code goes and what the viewer expects (file names, `SectionViewProps`). Change it together with the viewer.

  The ship's `codegen/generations.json` lists its finished generations, and decides the prompt: none yet means `first.md`. Delete it to start over with `first.md`.
- **Versions:** each finished generation becomes the section's next version: v1, v2, v3… Its generated files (every `.ts`/`.tsx` in the section's folder except `diagram.ts`) are kept in `codegen/<section ID>/v<N>/`, outside `src/`, so old versions are never built. A section's View modal lists its versions, with the drawing each came from and its cost, and **Restore** switches the section back to one:
  - its generated files are replaced by that version's, so changes made to them since are lost (they're still in their own version, unless made by hand);
  - the shared components stay as they are, since the ship's other sections use them, so the version is only restored if the ship still type-checks with it; otherwise nothing changes and the errors are shown;
  - it isn't possible while the ship's code is being generated. The next generation still gets the next number.
  Deleting a section deletes its versions.
- **Status** is shown in the Library's **Code** column (Queued, Generating…, 2D + 3D ready, Failed, Stopped, and the version in use, e.g. "v2 in use · 3 versions"), and in a section's View modal, with what the agent is doing, its summary, the files it wrote, the estimated cost, and **Generate again** or **Stop**. The viewer shows the version in use in the section's summary ("2D + 3D code v2"). It's saved in `section.json` as `codegen` (the latest generation), `codegenVersions` and `codegenVersion` (the version in use).
- **One at a time per ship:** a ship's generations share its components, so they run one after another. Uploading a new line diagram replaces a generation that's still running; removing the line diagram or deleting the section or ship stops it.
- **Checked, or undone:** the agent can only read the ship's folder, and write `.ts`/`.tsx` files in the section's folder and `src/shared/schematic/` (it gets no shell or web access). When it's done, both entry files must exist and the ship must have no new type errors, so `npm run build` keeps working. Otherwise, or when it's stopped, every file it wrote is put back as it was.
- A generation takes a few minutes and runs in the Next server process: one that's running when the server stops shows as interrupted (use **Generate again**). Each one costs money on the Anthropic account; the cost is shown when it's done.

Configure it in `.env.local` (Next loads it; it's git-ignored):

| Variable | Default | |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | | Required, unless Claude Code is signed in on this machine |
| `CODEGEN_MODEL` | `claude-opus-5-5` | The Claude model |
| `CODEGEN_EFFORT` | `high` | `low`, `medium`, `high`, `xhigh` or `max` |
| `CODEGEN_MAX_TURNS` | `120` | Stops a generation that takes more turns |
| `CODEGEN_MAX_BUDGET_USD` | none | Stops a generation that would cost more |

The agent doesn't load this machine's Claude Code settings, `CLAUDE.md` files, MCP servers, or a signed-in account's connectors, skills and plugins.

## Editor

`/editor` edits the child folder's shared files in the browser with [Monaco](https://microsoft.github.io/monaco-editor/), the editor behind VS Code: the `template/` new ships are copied from, and the dev server and build scripts around the ships. That's everything except `ships/`. A ship's **Editor** tab is the same editor for that ship's project folder only (e.g. to add a section's `diagram.ts`, or change that ship's viewer). Changing the template only affects ships added afterwards, because each ship has its own copy.

- **Only `child/` is reachable.** The file tree and the API see nothing outside it, and never show or touch `node_modules` or `.git`. Paths are checked name by name, and each path's real location (after symlinks and junctions) must be inside `child/`.
- **Each editor only reaches its own files.** The server refuses (403) anything outside the editor's scope: `/editor` can't open or create files in `ships/`, and a ship's Editor tab can't reach anything outside `ships/<ship>/`.
- **Saving:** Ctrl/Cmd+S or **Save**. While `npm run dev` runs, Vite reloads the viewer as soon as a file is saved. After `npm run build`, rebuild to see changes.
- **Changed on disk:** if a file was changed elsewhere (e.g. in an IDE) since it was opened, the save is refused, and you choose between loading the disk version and overwriting it.
- **New file** creates any missing folders. **Delete** removes the open file, and any folders that leaves empty.
- Text files (UTF-8) up to 1 MB. Images and other binary files are listed but can't be opened.
- Monaco's files are copied from `node_modules/monaco-editor` to `public/monaco/` (git-ignored) by `scripts/copy-monaco.mjs` after `npm install`, so no CDN is used. If the editor says it couldn't load, run `npm install` again.
- **No sign-in.** Like the rest of the API, the editor trusts anyone who can reach the server, and it can change the child's code (including `vite.config.ts`, which Vite runs). Writes from other websites open in the browser are refused, but other machines on your network aren't blocked. To keep the dev server private, run it as `next dev -H 127.0.0.1`.

## Where data is stored

```
child/ships/
  next-id.json                         ID counter for ships
  mv-aurora/                           one standalone viewer project per ship, named from its name when created
    ship.json                          its ID (SHP-001), name, dates, and imoNumber / vesselType / description if set
    codegen/                           its generated code's history, outside src/ so the viewer never builds it
      generations.json                 finished code generations (they decide between the first and second prompt)
      SEC-001/v1/, v2/, …              each version of a section's generated files, by section ID
    package.json, vite.config.ts,      the project, copied from child/template when the ship was created
      index.html, tsconfig*.json, README.md, src/app, src/shared
    src/shared/schematic/              shared components of the generated code, written by its first generation
    src/sections/
      index.ts                         the viewer's registry of drawings (code, not data)
      next-id.json                     ID counter for this ship's sections
      engine-room/                     one folder per section, named from its name when created
        section.json                   its ID (SEC-001), name, dates, files, the IDs of the objects it uses, and its code generation and versions
        lineDiagram-9f2c1a7b.png       its line diagram (at most one)
        manual-a1c2e3f4.pdf            its manual (at most one)
        manual-data.json               the component tables read from the manual, written on each manual upload
        diagram.ts, data.json          optional hotspots, written by hand
        Diagram2D.tsx, Diagram3D.tsx   the 2D and 3D views generated from the line diagram (the version in use), with any other files they use
    src/objects/
      index.ts, objects.ts             the viewer's registry of objects (code, not data)
      next-id.json                     ID counter for this ship's objects
      OBJ-001/
        object.json                    name, dates and files
        model-3be0d14c.glb
        lineDiagram-77aa01ff.png
```

- Everything is a normal file in the child folder, so it shows up in the editor and in `git status`. Commit it to share it, or add the folders to `.gitignore` to keep it local. Each ship's own `.gitignore` leaves out its `node_modules` and `dist`.
- **Renaming a ship** rewrites its `ship.json` only; its folder and its `package.json` name (`ship-<folder>`) stay.
- **IDs:** each ship gets a unique ID when it's created (`SHP-001`, `SHP-002`…). Sections (`SEC-001`…) and objects (`OBJ-001`…) are numbered per ship, so every ship starts at `SEC-001`. Each counter only increases, so IDs are never reused, even after a delete. IDs are used in the API and in links (`/projects/SHP-001/viewer?section=SEC-001`).
- **Ship and section folders** are made from the name when they're created: "Engine Room" becomes `engine-room`, and the ID is saved in `ship.json` or `section.json`. Renaming changes only the name; the ID and folder stay. Two ships, or two sections of one ship, can't have names that make the same folder.
- **Object folders** are named after the object's ID.
- **IMO number:** 7 digits, the last a check digit. It can be typed with or without "IMO" in front, and is saved as the 7 digits.
- A section's line diagram and manual are optional, and either can be replaced or removed later. An object needs both of its files.
- **Manual data:** each time a section's manual is uploaded, its component tables are read into `manual-data.json` in the section's folder, as a JSON array with one object per component. Each table has field names on the left (`id`, `pressure_rating`, `specs.material`…) and values on the right.
  - Where the values start is learned from each page's rows, so any column widths and page sizes work.
  - An `id` row starts a component. A later table with the same ID, e.g. continued on the next page, adds to it. A component with nothing but an ID is left out.
  - Dotted names become nested objects.
  - A row with only a value continues the previous field's text, if it's right below it on the same page, so page numbers and footers aren't added. A line in capitals is taken for a heading and skipped, unless the text it continues is in capitals too. A word broken after a hyphen ("self-" "closing") is joined up.
  - Once the whole manual is read, numbers, `true`, `false`, `null` and `none` are converted. `id` and `*_id(s)`, `*_number` and `*_no` fields stay text, and so do `*_code` fields unless they're `null`. So do numbers with leading zeros, like `007`, and ones too long to keep exactly, like serial numbers.
  - Field names start with a lower-case letter, so other text, such as headings, is skipped.
  - The count read, or why nothing could be read, is kept in `section.json` as `manualData` and shown under the manual in the Library.
  - A PDF without such tables is still saved as the manual, just without `manual-data.json`.
  - Removing the manual deletes the file. Replacing the manual writes the file again, which overwrites any hand edits.
- A section can only use objects of its own ship. An object can't be deleted while a section uses it. Remove it from those sections first.
- Deleting a section deletes its whole folder, including any files you added there in the editor. **Deleting a ship deletes its whole project folder: its code, sections, objects and their files.** Its `ship.json` goes first, so the ship disappears even if the rest can't be removed. On Windows that happens when a terminal or program is working inside the folder: then close it and delete the folder by hand (the server log names it); until then, a new ship can't take that folder name.
- **Writes:** all writes are queued, one at a time, so two saves can't get the same ID, and a ship can't be deleted halfway through a save inside it. Each metadata file is replaced in one step and written after the files it lists, so the viewer never sees a half-saved record.
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
| `GET /api/projects` | List ships, each with its `sectionCount` and `objectCount` |
| `POST /api/projects` | Create a ship (multipart: `name`, and optionally `imoNumber`, `vesselType`, `description`) |
| `PUT /api/projects/:id` (e.g. `/api/projects/SHP-001`) | Update a ship. Every field is sent each time; one left empty or out is cleared |
| `DELETE /api/projects/:id` | Delete a ship's folder, with all its sections and objects |
| `GET /api/projects/:id/:collection` | List a ship's records (`sections`, `objects`) |
| `POST /api/projects/:id/:collection` | Create a record (multipart: `name`, file fields, and for sections one `objectIds` value per object) |
| `PUT /api/projects/:id/:collection/:recordId` (e.g. `/api/projects/SHP-001/sections/SEC-001`) | Update the name and/or replace files; omitted files are kept, `remove=<field>` clears an optional one. `objectIds` replaces the section's list (send none to clear it) |
| `DELETE /api/projects/:id/:collection/:recordId` | Delete a record's folder; 409 for an object a section still uses |
| `POST /api/projects/:id/sections/:recordId/codegen` | Generate a section's code again from its line diagram (202); 400 without a line diagram |
| `PUT /api/projects/:id/sections/:recordId/codegen` | Switch a section's code to one of its versions, from JSON `{ "version": 2 }`; 409 if it doesn't type-check with the ship's current shared components (nothing changes), or while the ship's code is being generated |
| `DELETE /api/projects/:id/sections/:recordId/codegen` | Stop a section's code generation; responds once its files are rolled back |
| `GET /api/files/:ship/:collection/:folder/:file` | Serve a file from a record's folder, by folder names (e.g. `/api/files/mv-aurora/sections/engine-room/manual-a1c2e3f4.pdf`) |
| `GET /api/child-files` | The child app's shared files (everything but `ships/`), as a tree (editor). With `?project=<folder>` (e.g. `?project=mv-aurora`), only that ship's folder |
| `GET /api/child-files/:path*` | Open a file: `{ path, content, version }` |
| `POST /api/child-files/:path*` | Create a file from JSON `{ content }`; 409 if it exists |
| `PUT /api/child-files/:path*` | Save JSON `{ content, version }`; 409 if the file changed since `version` |
| `DELETE /api/child-files/:path*` | Delete a file |

Requests that change something are refused (403) when another website sends them from the browser. The `/api/child-files` requests take the same optional `?project=<folder>`. Paths are relative to `child/` (e.g. `template/src/main.tsx`), or with `?project=` to `child/ships/` (e.g. `mv-aurora/src/main.tsx`), and one outside the requested scope is refused (403).

## Code map

Code used by only one page lives next to that page in a `_components/` folder (folders starting with `_` are never routes). Only code shared by more than one page goes in `src/components/`.

| Path | Purpose |
| --- | --- |
| `src/types/records.ts` | `Project`, `Section`, `ObjectRecord`, `StoredFile` interfaces |
| `src/lib/collection-defs.ts`, `src/lib/imo.ts` | Per-collection folder, IDs, file, text and link fields, shared by the UI and the server; IMO number checks |
| `src/server/storage.ts` | Reads and writes ship, section and object folders in the child app |
| `src/server/manual-data.ts` | Reads a section manual's component tables (with PDF.js) for `manual-data.json` |
| `src/server/codegen/` | Generates sections' React code: `jobs.ts` (queue per ship, first or second prompt, checks, rollback, versions and restoring them), `agent.ts` (the Claude Agent SDK run), `policy.ts` (what the agent may read and write, and the rollback journal), `typecheck.ts`, `prompts.ts` and `prompts/*.md`, `runtime.ts` (this process's jobs). `src/lib/codegen.ts` holds what the Library shares with it |
| `src/app/api/` | Route handlers for the API above |
| `src/lib/storage.ts`, `src/lib/collections.ts` | Client-side stores that call the API and cache results: the ships, and each ship's sections and objects |
| `src/app/(dashboard)/` | Top-level pages, grouped without adding to the URL: the projects page `/` (ship cards) and `/editor` for the shared files |
| `src/app/projects/[projectId]/` | A ship's Library, Viewer and Editor pages. `layout.tsx` gives them one frame (header, breadcrumb, page links) that stays mounted between them, and always renders the page, as Next's instant-navigation check needs. Each page wraps its content in `_components/ProjectWorkspace`, which finds the ship (loading, error and not-found states) and provides it through `useProject()`; `_components/` also holds the Library's tabs and view modal; `viewer/_components/` holds the iframe host that shows the ship's viewer and drives it; `editor/_components/` scopes the editor to the ship |
| `src/components/layout/` | `DashboardFrame`: the header, main nav, and a ship's breadcrumb and page links |
| `src/components/records/` | Shared CRUD UI: collection configs, table, add/edit form (with the object picker and text fields), and sections' code generation status (`CodegenStatus.tsx`) |
| `src/components/ui/`, `src/components/files/` | Reusable modal, confirm dialog, tabs, inputs, file upload, toasts, pagination; file thumbnails and details |
| `src/components/editor/` | The editor behind `/editor` and each ship's Editor page: file tree, open-file tabs, Monaco |
| `src/lib/viewer-bridge.ts`, `src/hooks/useViewerEvents.ts` | Parent side of the message bridge |
| `src/server/child-files.ts`, `src/server/child-dir.ts` | Reads and writes `child/` for the editors, refusing anything outside it or outside the editor's scope (shared files, or one ship); shared helpers |
| `src/lib/child-files.ts`, `src/lib/child-files-api.ts` | Editor rules and types (shared), and the client for its API |
| `src/lib/monaco.ts`, `scripts/copy-monaco.mjs` | Loads Monaco from `public/monaco`, which is copied there on install |
| `child/vite.config.ts`, `child/build-ships.mjs` | Development server for every ship, and the build of every ship (or the named ones) into `public/child/` for Next, or with `--standalone` into each ship's own `dist/` |
| `child/template/` | The viewer project each new ship is copied from (its `ship.json` is a placeholder, so it can run on its own) |
| `child/ships/<ship>/` | One ship's standalone viewer project, with its data |
| `…/src/app/` | Viewer shell, message bridge and protocol; `src/ship.ts` reads the project's `ship.json` |
| `…/src/sections/`, `…/src/objects/` | The ship's sections and objects, plus the registries in `index.ts` that find them |
| `…/src/shared/` | Viewer building blocks: `catalog`, `diagram`, `data`, `records` (reads Library folders), `operations` (viewer state), `view2d`, `view3d`, `manual`, `ui`, `components` (including `GeneratedView`, which loads a section's generated view), `assets`; and `schematic`, the generated code's shared components, once a section has some |
