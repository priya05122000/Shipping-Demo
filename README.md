# Ship Docs: Document & Diagram Management

An admin UI for **Ships**, each with its own **Sections** and **Objects**:

- A **ship** is one project: a **React + Vite viewer project** of its own (`child/ships/<ship>/`), which is built and deployed on its own. It holds the ship's data and generated code, and its own customizations (UI and functionality for that ship only); the viewer itself is shared by every ship (`child/core/`), so a change there reaches every ship when it's rebuilt. A ship has a name and, optionally, an IMO number, a vessel type and a description. Everything else belongs to one ship.
- A **section** is one drawing of a ship. It holds **one line diagram**, **one manual** (PDF), and the objects it uses.
- An **object** (3D model + line diagram) is **shared** within its ship, so any of that ship's sections can use it.

Built with Next.js (App Router), TypeScript and Tailwind CSS. Each ship's sections and objects are saved as **folders inside the ship's own project** (`child/ships/<ship>/`) on the machine running the app, so its viewer can show them. There's no database and no cloud.

Uploading a section's line diagram also **generates React code** for it with AI: an interactive 2D view and a 3D view, written into the ship's project (see [Generated 2D and 3D code](#generated-2d-and-3d-code)). Set `ANTHROPIC_API_KEY` in `.env.local` for that.

```bash
npm install             # the parent (Next) only, and copies Monaco to public/monaco
npm run install:child   # the child (the ships' viewers): its own install, in child/node_modules
npm run dev             # both apps: Next on http://localhost:3000, Vite (every ship's viewer) on :5173
npm run build           # the Next app only: nothing in child/ is part of it
npm run build:ships     # every ship, each on its own, into child/dist/<ship>/ (a static site to deploy)
npm run build:ships -- mv-aurora   # only the named ships (folder names in child/ships)
npm run serve:ships     # serves child/dist at http://localhost:4173/child/<ship>/, like a static host
npm run lint
```

`npm run dev:parent` and `npm run dev:child` start one app at a time. After switching from a checkout where the child was an npm workspace of the parent, run `npm install` and then `npm run install:child`: the parent's install no longer installs the child.

## Parent and child apps

The repo holds two apps, installed, built and deployed separately:

- **Parent** (this folder): the Next.js admin, which owns the `/api` routes and saves ships, sections and objects into the child's folders. Its install, type check and build don't include anything from `child/` (no npm workspace, no import, no build step), so a change in the child can't break them.
- **Child** (`child/`, see [child/README.md](child/README.md)): the ships' **viewers** for interactive line diagrams, with their own `package.json`, lockfile and `node_modules`. Each ship's viewer is built from **three layers**:

  | Layer | Where | Reaches | Changed by |
  | --- | --- | --- | --- |
  | 1. **Common**: the viewer (UI, data loading, message bridge, Vite config) | `child/core/` (`@shipdocs/viewer-core`) | every ship | people |
  | 2. **Ship customization**: theme, labels, replaced or wrapped components, extra views, buttons, hooks, and CSS for its buttons and other UI | `child/ships/<ship>/src/custom/` | that ship only | people |
  | 3. **Ship content**: data and generated code | `child/ships/<ship>/` `ship.json`, `src/sections/`, `src/objects/`, `src/shared/schematic/` | that ship only | the Library and code generation |

  - `child/core/`: **`@shipdocs/viewer-core`, the viewer every ship runs**: its UI (app shell, section list, 2D/3D/manual views, the objects' components), how it reads a ship's content and customizations, the message bridge, and the ships' Vite config. Ships import it, so **one change here reaches every ship** the next time it's built (at once, in the dev server), including what customized ships don't override.
  - `child/ships/<ship>/`: **one project per ship**, holding that ship's content and its **customizations** (`src/custom/index.tsx`: `defineShipCustomization({ theme, labels, components, views, actions, hooks })`, and CSS it imports, which can restyle the viewer's buttons and other parts through their `data-ui` attributes, see [child/README.md](child/README.md#customizing-one-ship-layer-2)), plus a few small files that start the shared viewer (`src/main.tsx`, `vite.config.ts`…). Each is built, deployed and run on its own, so a ship's customizations reach that ship only.
  - `child/template/`: what a new ship's folder is made from: those small files, without data.
  - `child/vite.config.ts`, `child/build-ships.mjs`, `child/serve-ships.mjs`: one Vite dev server for every ship, the build of each ship on its own into `child/dist/<ship>/`, and a local static server for those builds.
  - `child/scripts/migrate-ship.mjs` (`npm --prefix child run migrate`): turns a ship made before `child/core` existed (with its own copy of the viewer's code) into one that uses it.

| Page | What it shows |
| --- | --- |
| `/` | **Projects**: a card per ship, with **New ship**, edit and delete |
| `/projects/:id` | The ship's **Library**: its Sections and Objects tabs |
| `/projects/:id/viewer` | The child for that ship, in an `<iframe>` |
| `/projects/:id/editor` | The editor, showing only the ship's project folder |
| `/editor` | The editor for the child folder's shared files: the shared viewer (`core/`), the template, the dev server and build scripts (not the ships) |

The parent shows each ship's viewer on its own origin, at `/child/<ship>/index.html`, by **proxying** `/child/*` to wherever the viewers are hosted: `SHIP_VIEWER_URL` (a rewrite in `next.config.ts`, read when the parent is built). The parent never contains the viewers' files, so deploying a ship never means redeploying the parent, and the other way round.

| Mode | Where `/child/*` goes |
| --- | --- |
| `npm run dev` | The child's Vite dev server (`SHIP_VIEWER_URL` defaults to `http://localhost:5173/child`), which serves every ship in `child/ships`. A new ship works straight away, and a change to `child/core` updates every ship's viewer at once. Vite's hot reload connects to `:5173` directly (`CHILD_DEV_PORT` changes the port; set `SHIP_VIEWER_URL` to match). |
| production | Wherever the built ships are deployed, each at `<SHIP_VIEWER_URL>/<ship>/`, e.g. `SHIP_VIEWER_URL=https://ships.example.com`. Set it when building the parent. Without it, no viewer can be shown. A ship that isn't deployed (yet) shows "isn't deployed yet". |

**Building and deploying ships.** `npm run build:ships` builds every ship, and `npm run build:ships -- <ship>` (one or several folder names) only those. Each ship is type-checked and built on its own into `child/dist/<ship>/`: a ship that fails doesn't stop the others, and leaves no output (the command then exits with an error, naming it). Each `child/dist/<ship>/` is a complete static site: the shared viewer, the ship's sections, objects, images and manuals are all in it, it uses relative URLs (so it works at any path), and it has one page and no client-side routes. Upload it to any static file host (S3/CloudFront, Nginx, Netlify, GitHub Pages…), at `<SHIP_VIEWER_URL>/<ship>/` for Ship Docs, or anywhere on its own. Let the host cache `assets/` for good (their names carry a content hash). Rebuild a ship after changing it in the Library or editor, and every ship after changing `child/core`. To try it on one machine: `npm run build:ships`, `npm run serve:ships`, then build and start the parent with `SHIP_VIEWER_URL=http://localhost:4173/child`.

Inside a ship's folder, `npm run dev`, `npm run build` (into its own `dist/`) and `npm run preview` work too, with the child's packages. When hosted on its own, a viewer shows its own header and drawing list. It doesn't work as a cross-origin embed: the message bridge only talks to a parent on the same origin, which is why the parent proxies it.

**Messages.** The apps talk only through `postMessage`. Each side has its own copy of the contract: the parent's `src/lib/viewer-protocol.ts`, and the shared viewer's `child/core/src/app/protocol.ts`. The parent checks every message it receives against it, and ignores one that doesn't match, so a viewer built from older or newer code can't break it. Change both together, and keep changes backwards compatible.

- Parent → child: `open-section`
- Child → parent: `ready` (the full viewer state, re-sent after reloads and hot updates), `section-changed` and `item-selected`

`ready` includes `shipId`, from the project's `ship.json`; the parent checks that it's the ship it opened. Both sides ignore messages from any other window or origin. The parent keeps the open drawing in `/projects/<ship>/viewer?section=<id>`.

**Adding a drawing.** Add a ship on the Projects page (`/`), open it, and add a section in its Library. That creates the section's folder in `child/ships/<ship>/src/sections/`, and the ship's viewer finds it on its own: the shared viewer's Vite plugin gives each ship a `virtual:ship-manifest` module whose `import.meta.glob`s find that ship's sections and objects (`child/core/vite.js`). While `npm run dev` runs, the viewer updates as soon as a section or object is saved. Otherwise, rebuild and redeploy the ship to see changes.

The viewer shows a section's line diagram (**2D**), its objects (**3D**; the generated code renders their models, while the viewer's own 3D tab still lists them) and its **Manual**. Once a section has [generated code](#generated-2d-and-3d-code), **2D** and **3D** show that instead, and the uploaded line diagram moves to its own **Drawing** view. To make parts of a line diagram clickable, add two files to the section's folder, e.g. in the editor:
- `diagram.ts`: `export default defineDiagram({ width, height, items })` (from `@shipdocs/viewer-core/diagram`). `width`/`height` are the image's pixel size; each item is a hotspot rectangle in those pixels.
- `data.json`: `{ "items": { "<item id>": { "description": "…", "specs": { "Label": "Value" } } } }`

## Generated 2D and 3D code

When a section's line diagram is uploaded (with a new section, or replacing one), the parent turns it into React code with the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview): Claude looks at the drawing and writes the code into the ship's project, where the ship's viewer shows it.

- **What's written:** the section's `Diagram2D.tsx` (SVG) and `Diagram3D.tsx` ([react-three-fiber](https://r3f.docs.pmnd.rs/)) in its folder, plus the ship's **shared schematic components** in `src/shared/schematic/` (one 2D and one 3D component per kind of equipment, pipes, and the types that describe a drawing), which every section's code uses. It builds on the shared viewer (`@shipdocs/viewer-core`: `SectionViewProps`, `ObjectSymbol2D`, `ObjectModel3D`, `objectPort`…), which it reads but **never changes**: the viewer is every ship's, so a generation for one ship can't change another. Something the shared viewer lacks is written in the ship, and suggested in the agent's summary for people to add to `child/core` (see **Only the ship** below). It's ordinary code: change it in the editor like any other file.
- **Two prompts**, in `src/server/codegen/prompts/` (Markdown, read again for each generation, so edits apply straight away):
  - `first.md` for a ship's **first** generation: creates the shared components, simply.
  - `second.md` for **every later** generation of the ship: reuses the shared components, adding to them only in ways that keep the other sections working.
  - `rules.md` goes with both: where code goes and what the viewer expects (file names, `SectionViewProps`), reading before writing, and fixing errors. Change it together with the viewer.

  Both prompts include the **file trees** of the ship's project and of the shared viewer (`{{projectTree}}` and `{{coreTree}}`, without `node_modules`, `dist` and `codegen/`), so the agent starts from the projects' real structure.

  The ship's `codegen/generations.json` lists its finished generations, and decides the prompt: none yet means `first.md`. Delete it to start over with `first.md`.
- **Versions:** each finished generation becomes the section's next version: v1, v2, v3… Its generated files (every `.ts`/`.tsx` in the section's folder except `diagram.ts`) are kept in `codegen/<section ID>/v<N>/`, outside `src/`, so old versions are never built. A section's View modal lists its versions, with the drawing each came from and its cost, and **Restore** switches the section back to one:
  - its generated files are replaced by that version's, so changes made to them since are lost (they're still in their own version, unless made by hand);
  - the shared components, and any other files outside the section's folder, stay as they are, since the ship's other sections use them, so the version is only restored if the ship still type-checks with it; otherwise nothing changes and the errors are shown;
  - it isn't possible while the ship's code is being generated. The next generation still gets the next number.
  Deleting a section deletes its versions.
- **Status** is shown in the Library's **Code** column (Queued, Generating…, 2D + 3D ready, Failed, Stopped, and the version in use, e.g. "v2 in use · 3 versions"), and in a section's View modal, with what the agent is doing, its summary, the files it wrote, the estimated cost, and **Generate again** or **Stop**. The viewer shows the version in use in the section's summary ("2D + 3D code v2"). It's saved in `section.json` as `codegen` (the latest generation), `codegenVersions` and `codegenVersion` (the version in use).
- **One at a time:** a ship's generations share its components, and each type-checks a whole project, so generations run one after another, across all ships (restoring a version only waits for its own ship). Uploading a new line diagram replaces a generation that's still running; removing the line diagram or deleting the section or ship stops it.
- **Objects are looked at once:** a section's objects (picked in the Library) are drawn by the viewer's own components, `ObjectSymbol2D` (the object's image, in SVG) and `ObjectModel3D` (its 3D model: GLB, GLTF, OBJ, FBX or STL, else a plain box), with `objectPort` giving where pipes connect (`child/core/src/objects/`, imported as `@shipdocs/viewer-core/objects` and `@shipdocs/viewer-core/objects/model3d`). So the agent places objects, but never needs their files:
  - The **first** generation that uses an object (for any section of the ship) sends its image with the task: PNG, JPEG and WEBP as images, an SVG for the agent to read as text. The agent writes the object's **card**, `src/objects/<ID>/card.json`: its kind, what it looks like, its aspect ratio and its connection points. The job checks it and saves it with the image's stored name and its measured aspect ratio.
  - **Every later** generation gets the card as text (about 60 tokens) instead of the image (about 1,000 to 5,000 tokens, re-read on every request of the run), and the agent can't read the object's files at all.
  - Replacing an object's image in the Library makes its card stale (its `image` no longer matches), so the next generation that uses it looks at the new image. A card that's missing or wrong when the agent finishes is left out, and never fails the generation. At most 12 new objects, and 8 MB of their images, are looked at per generation; any more are placed from their names and looked at next time.
  - The View modal says which objects were looked at and which came from their cards (`codegen.objects` in `section.json`, also in `usage.jsonl`). The code is in `src/server/codegen/objects.ts`.
- **Reads first:** the agent's writes are refused until it has read the shared viewer's `child/core/src/shared/diagram/section.ts` (the views' props), at least one file in `src/shared/schematic/` once the ship has shared components, and every object's SVG image it's told to read. Claude Code also refuses to change a file the agent hasn't read, so existing files are changed based on what's in them.
- **Errors go back to the agent:** after each file it writes, the ship's project is type-checked (with the shared viewer, as its build compiles it) and the new errors (those in that file first) are added to the result of its write, so it fixes them right away. When it wants to finish, the code is checked again (both entry files, no new type errors in the ship). If something's wrong, the errors are sent back and it keeps working, up to `CODEGEN_FIX_ROUNDS` times. The Library shows this as "Fixing errors in the generated code (round 1 of 3)".
- **Works on a copy:** the agent works on a copy of the ship's project, the generation's **stage** (`child/.codegen-stage/<run>/`, left out by the editor and git; `src/server/codegen/staging.ts`). The real ship doesn't change while it works, so the viewer never shows half-written code. Once everything below has passed, the stage's changes are **applied**: every path is checked again right before it's written, each file is replaced in one step, and if a real file changed meanwhile (e.g. in the editor) nothing at all is applied. If the generation fails, is stopped, or reaches a limit, the stage is discarded and nothing real changes.
- **Only the ship:** nothing outside `child/`, such as the Ship Docs app (the parent), can be read or changed by the agent. In `child/`, it can read anything except the ships' `codegen/` folders and other stages, and write files and folders in one place: its copy of the ship's project. The shared viewer (`child/core`) and the template are refused, since they're every ship's and maintained by people; so are other ships, since each is a project of its own (and may be generating code itself), and `child/`'s own files (the dev server and build scripts, which run on this machine). It gets no shell or web access.
- **Path checks, before and after every tool call:** every call (Read, Write, Edit, Glob, Grep and `typecheck`) goes through `src/server/codegen/policy.ts` before it runs: a path with `..` is refused, and so is any path through a symlink or junction (even one inside `child/`) and any hard-linked file; a search is refused if the folder it reads holds one. The tool then gets the checked absolute path in place of the one the agent gave. After the call, the same path is checked again and the stage is scanned for links: if anything changed in between (a time-of-check/time-of-use race), the tool's result is withheld and the generation fails. The server's own file work for a generation (copying the stage, applying it, keeping versions, restoring one) checks its sources and destinations the same way. In the ship it can write any file except:
  - the Library's records, which the parent writes: `ship.json`, `section.json`, `object.json`, `next-id.json`, `manual-data.json` and the uploaded files (`lineDiagram-…`, `manual-…`, objects' `<name>-2d-…` and `<name>-3d-…`, and older objects' `lineDiagram-…` and `model-…`);
  - the build and check settings: `package.json`, `package-lock.json`, `vite.config.*` and `tsconfig*.json`, since a change could run code on this machine at the next build, or switch off the type check that catches the agent's errors;
  - the ship's entry files, `src/main.tsx`, `src/env.d.ts` and `src/styles.css`, which start the shared viewer and are the same in every ship;
  - the ship's customizations, `src/custom/`, which people make (the agent reads them);
  - files directly in `src/objects/`, and in an object's folder anything but its `card.json`, which can be written only for the objects whose images the generation shows it. Objects' uploaded files (images and models) can't be read either, apart from the SVG images it's told to read;
  - `codegen/`, `dist/` and `node_modules/`.

  These rules are in `src/server/codegen/policy.ts`.
- **Shared UI is changed by people:** a change every ship needs (a fix to the viewer, a new shared component) is made in `child/core`, in the editor's shared files or an IDE, and reaches every ship when it's rebuilt. A generation only reports such a need, in its summary. (Generations made before this could change the template; their records still show whether that change was kept, as `sharedChange` in `section.json`.)
- **Checked, or discarded:** when the agent is done, the section's own code is checked: both entry files must exist and the ship must have no new type errors, so its build keeps working. Otherwise, or when it's stopped, its stage is discarded.
- **Untrusted content:** only Claude Code's system prompt with `rules.md` appended, and the task (`first.md` or `second.md`), are instructions. They're read only from those three regular files, and nothing from this machine's Claude Code setup is loaded. Everything else is data, and `rules.md` says so: the drawing (image or SVG), names, descriptions, tags and labels, `manual-data.json`, source code and its comments, documentation, and tool results. Text that came from people goes into the prompts quoted (names) or fenced as `data` (file trees, type checker messages, which quote the code), with control and direction-override characters removed, so it can't pass for the prompt (`src/server/codegen/untrusted.ts`).
- **Limits:** a generation stops as soon as it reaches its budget (`CODEGEN_MAX_BUDGET_USD`, the SDK's cost estimate), its turns (`CODEGEN_MAX_TURNS`), or still has problems after its rounds of fixes (`CODEGEN_FIX_ROUNDS`). It then fails, its stage is discarded, and the View modal says which limit stopped it.
- **Usage:** every generation, however it ends (done, failed, stopped, or stopped before it started), records its input and output tokens (with cache reads and writes), turns, estimated cost and status: the latest in `section.json` (`codegen.usage`, shown in the View modal), and all of them in the ship's `codegen/usage.jsonl`, one JSON line each. A generation stopped before the SDK reported a cost has its tokens so far, and no cost.
- A generation takes a few minutes and runs in the Next server process: one that's running when the server stops shows as interrupted (use **Generate again**), and its stage is removed when the next generation starts. Each one costs money on the Anthropic account; the cost is shown when it's done.

Configure it in `.env.local` (Next loads it; it's git-ignored):

| Variable | Default | |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | | Required, unless Claude Code is signed in on this machine |
| `CODEGEN_MODEL` | `claude-opus-5-5` | The Claude model |
| `CODEGEN_EFFORT` | `high` | `low`, `medium`, `high`, `xhigh` or `max` |
| `CODEGEN_MAX_BUDGET_USD` | `5` | Stops a generation when its estimated cost reaches this, and discards it. `none` for no limit |
| `CODEGEN_MAX_TURNS` | `120` | Stops a generation that takes more turns, and discards it |
| `CODEGEN_FIX_ROUNDS` | `3` | How often the agent is sent back to fix errors when it wants to finish; still wrong after that stops it and discards it. `0`: no rounds |

The agent doesn't load this machine's Claude Code settings, `CLAUDE.md` files, MCP servers, or a signed-in account's connectors, skills and plugins.

## Editor

`/editor` edits the child folder's shared files in the browser with [Monaco](https://microsoft.github.io/monaco-editor/), the editor behind VS Code: the shared viewer every ship runs (`core/`, where a change reaches every ship), the `template/` new ships are made from, and the dev server and build scripts around the ships. That's everything except `ships/`. A ship's **Editor** tab is the same editor for that ship's project folder only (e.g. to add a section's `diagram.ts`, or change its generated code).

- **Only `child/` is reachable.** The file tree and the API see nothing outside it, and never show or touch `node_modules`, `dist` or `.git`. Paths are checked name by name, and each path's real location (after symlinks and junctions) must be inside `child/`.
- **Each editor only reaches its own files.** The server refuses (403) anything outside the editor's scope: `/editor` can't open or create files in `ships/`, and a ship's Editor tab can't reach anything outside `ships/<ship>/`.
- **Saving:** Ctrl/Cmd+S or **Save**. While `npm run dev` runs, Vite updates the viewer as soon as a file is saved (every ship's, for a file in `core/`). Otherwise, rebuild and redeploy the ships to see changes.
- **Changed on disk:** if a file was changed elsewhere (e.g. in an IDE) since it was opened, the save is refused, and you choose between loading the disk version and overwriting it.
- **New file** creates any missing folders. **Delete** removes the open file, and any folders that leaves empty.
- Text files (UTF-8) up to 1 MB. Images and other binary files are listed but can't be opened.
- Monaco's files are copied from `node_modules/monaco-editor` to `public/monaco/` (git-ignored) by `scripts/copy-monaco.mjs` after `npm install`, so no CDN is used. If the editor says it couldn't load, run `npm install` again.
- **No sign-in.** Like the rest of the API, the editor trusts anyone who can reach the server, and it can change the child's code (including `vite.config.ts`, which Vite runs). Writes from other websites open in the browser are refused, but other machines on your network aren't blocked. To keep the dev server private, run it as `next dev -H 127.0.0.1`.

## Where data is stored

```
child/core/                            the viewer every ship runs (@shipdocs/viewer-core): code, not data
child/ships/
  next-id.json                         ID counter for ships
  mv-aurora/                           one viewer project per ship, named from its name when created
    ship.json                          its ID (SHP-001), name, dates, and imoNumber / vesselType / description if set
    codegen/                           its generated code's history, outside src/ so the viewer never builds it
      generations.json                 finished code generations (they decide between the first and second prompt)
      usage.jsonl                      every code generation's status, tokens and cost, one JSON line each
      SEC-001/v1/, v2/, …              each version of a section's generated files, by section ID
    package.json, vite.config.ts,      the project's files, made from child/template when the ship was created: they
      index.html, tsconfig*.json,        start the shared viewer (child/core) with this ship's data
      README.md, src/main.tsx,
      src/env.d.ts, src/styles.css
    src/custom/                        this ship's customizations (index.tsx, and what it uses), made by people
    src/shared/schematic/              shared components of the generated code, written by its first generation
    src/sections/
      next-id.json                     ID counter for this ship's sections
      engine-room/                     one folder per section, named from its name when created
        section.json                   its ID (SEC-001), name, dates, files, the IDs of the objects it uses, and its code generation and versions
        lineDiagram-9f2c1a7b.png       its line diagram (at most one)
        manual-a1c2e3f4.pdf            its manual (at most one)
        manual-data.json               the component tables read from the manual, written on each manual upload
        diagram.ts, data.json          optional hotspots, written by hand
        Diagram2D.tsx, Diagram3D.tsx   the 2D and 3D views generated from the line diagram (the version in use), with any other files they use
    src/objects/
      next-id.json                     ID counter for this ship's objects
      OBJ-001/
        object.json                    name, dates and files, each file with its view ("2d" or "3d")
        fuel-pump-3d-3be0d14c.glb      its 3D diagram, named from the object's name and tagged 3d
        fuel-pump-2d-77aa01ff.png      its line diagram, tagged 2d
        card.json                      what code generation learned from the 2D image, so it isn't sent again
```

- Everything is a normal file in the child folder, so it shows up in the editor and in `git status`. Commit it to share it, or add the folders to `.gitignore` to keep it local. Each ship's own `.gitignore` leaves out its `node_modules` and `dist`, and the repo's leaves out `child/dist`.
- **Renaming a ship** rewrites its `ship.json` only; its folder and its `package.json` name (`ship-<folder>`) stay.
- **IDs:** each ship gets a unique ID when it's created (`SHP-001`, `SHP-002`…). Sections (`SEC-001`…) and objects (`OBJ-001`…) are numbered per ship, so every ship starts at `SEC-001`. Each counter only increases, so IDs are never reused, even after a delete. IDs are used in the API and in links (`/projects/SHP-001/viewer?section=SEC-001`).
- **Ship and section folders** are made from the name when they're created: "Engine Room" becomes `engine-room`, and the ID is saved in `ship.json` or `section.json`. Renaming changes only the name; the ID and folder stay. Two ships, or two sections of one ship, can't have names that make the same folder.
- **Object folders** are named after the object's ID.
- **Object files** are named from the object's name and tagged with the view they're for: "Fuel Pump" saves `fuel-pump-2d-77aa01ff.png` (the line diagram, drawn by `ObjectSymbol2D`) and `fuel-pump-3d-3be0d14c.glb` (the 3D diagram, shown by `ObjectModel3D`). The tag, not the format, tells them apart, since the 3D diagram can be an image for now. `object.json` says the same (`"view": "2d"` or `"3d"` on each file), and the code generation prompt names both files of every object, so the agent never mixes them up. The type is `DiagramView` in `src/lib/files.ts`. The last part is unique to each upload. A name without letters or digits uses the ID instead (`obj-001-3d-…`). Renaming an object doesn't rename its files: a file keeps the name it was saved with, as the folder does, and the next upload uses the new name. Objects saved before this keep their `lineDiagram-…` and `model-…` files, which still work.
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
| 3D diagram | GLB, GLTF, OBJ, FBX, STL, BLEND; for now also JPG, JPEG, PNG, WEBP, SVG (shown as a flat picture in 3D) | 2 MB |
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

Requests that change something are refused (403) when another website sends them from the browser. The `/api/child-files` requests take the same optional `?project=<folder>`. Paths are relative to `child/` (e.g. `core/src/app/App.tsx`), or with `?project=` to `child/ships/` (e.g. `mv-aurora/src/main.tsx`), and one outside the requested scope is refused (403).

## Code map

Code used by only one page lives next to that page in a `_components/` folder (folders starting with `_` are never routes). Only code shared by more than one page goes in `src/components/`.

| Path | Purpose |
| --- | --- |
| `src/types/records.ts` | `Project`, `Section`, `ObjectRecord`, `StoredFile` interfaces |
| `src/lib/collection-defs.ts`, `src/lib/imo.ts` | Per-collection folder, IDs, file, text and link fields, shared by the UI and the server; IMO number checks |
| `src/server/storage.ts` | Reads and writes ship, section and object folders in the child app |
| `src/server/manual-data.ts` | Reads a section manual's component tables (with PDF.js) for `manual-data.json` |
| `src/server/codegen/` | Generates sections' React code: `jobs.ts` (queue per ship, first or second prompt, checks, rollback, versions and restoring them), `agent.ts` (the Claude Agent SDK run, and its hooks: the file rules before each tool call, the type check after each write, the fix rounds before it finishes), `policy.ts` (what the agent may read and write, and the rollback journal), `structure.ts` (the project's file tree for the prompt, and the files to read before writing), `typecheck.ts` (tsc from the child's install, and the run's `TypeChecker`), `staging.ts` (the generation's working copy, and applying it), `untrusted.ts` (quoting and fencing text that came from people), `prompts.ts` and `prompts/*.md`, `runtime.ts` (this process's jobs). `src/lib/codegen.ts` holds what the Library shares with it |
| `src/app/api/` | Route handlers for the API above |
| `src/lib/storage.ts`, `src/lib/collections.ts` | Client-side stores that call the API and cache results: the ships, and each ship's sections and objects |
| `src/app/(dashboard)/` | Top-level pages, grouped without adding to the URL: the projects page `/` (ship cards) and `/editor` for the shared files |
| `src/app/projects/[projectId]/` | A ship's Library, Viewer and Editor pages. `layout.tsx` gives them one frame (header, breadcrumb, page links) that stays mounted between them, and always renders the page, as Next's instant-navigation check needs. Each page wraps its content in `_components/ProjectWorkspace`, which finds the ship (loading, error and not-found states) and provides it through `useProject()`; `_components/` also holds the Library's tabs and view modal; `viewer/_components/` holds the iframe host that shows the ship's viewer and drives it; `editor/_components/` scopes the editor to the ship |
| `src/components/layout/` | `DashboardFrame`: the header, main nav, and a ship's breadcrumb and page links |
| `src/components/records/` | Shared CRUD UI: collection configs, table, add/edit form (with the object picker and text fields), and sections' code generation status (`CodegenStatus.tsx`) |
| `src/components/ui/`, `src/components/files/` | Reusable modal, confirm dialog, tabs, inputs, file upload, toasts, pagination; file thumbnails and details |
| `src/components/editor/` | The editor behind `/editor` and each ship's Editor page: file tree, open-file tabs, Monaco |
| `src/lib/viewer-protocol.ts`, `src/lib/viewer-bridge.ts`, `src/hooks/useViewerEvents.ts` | Parent side of the message bridge: its copy of the contract (checking every message), the viewer's URL, and sending and receiving |
| `src/server/child-files.ts`, `src/server/child-dir.ts` | Reads and writes `child/` for the editors, refusing anything outside it or outside the editor's scope (shared files, or one ship); shared helpers |
| `src/lib/child-files.ts`, `src/lib/child-files-api.ts` | Editor rules and types (shared), and the client for its API |
| `src/lib/monaco.ts`, `scripts/copy-monaco.mjs` | Loads Monaco from `public/monaco`, which is copied there on install |
| `child/package.json` | The child app: its own install (`npm run install:child`), with `core/` as its one npm workspace |
| `child/vite.config.ts`, `child/build-ships.mjs`, `child/serve-ships.mjs` | Development server for every ship; the build of every ship (or the named ones), each on its own, into `child/dist/<ship>/`; a local static server for those builds |
| `child/core/` | `@shipdocs/viewer-core`, the viewer every ship runs (layer 1). `vite.js`: the ships' Vite config, and the plugin that gives each ship its `virtual:ship-manifest` (its content and customizations, through `import.meta.glob`) and its `@/` imports. `src/index.tsx`: `mountShip`. `src/ship.ts`: the loaded ship, kept up to date by hot updates |
| `child/core/src/customization.ts`, `customize.ts`, `theme.ts` | The extension points of layer 2 (`ShipCustomization`, `defineShipCustomization`), what `@shipdocs/viewer-core/customize` offers a ship's `src/custom/`, and the theme's accent colour |
| `child/core/src/app/` | Viewer shell (applying a ship's customizations: `customized.tsx`), message bridge and protocol |
| `child/core/src/sections/`, `child/core/src/objects/` | Reading a ship's sections and objects from its manifest; `ObjectSymbol2D`, `ObjectModel3D`, `objectPort` and cards for generated code |
| `child/core/src/shared/` | Viewer building blocks: `catalog`, `diagram`, `data`, `records`, `operations` (viewer state), `view2d`, `view3d`, `manual`, `ui`, `components` (including `GeneratedView`, which loads a section's generated view), `assets` |
| `child/template/` | What each new ship's folder is made from (its `ship.json` is a placeholder) |
| `child/ships/<ship>/` | One ship's project: its customizations (`src/custom/`, layer 2), its data and generated code (`src/sections/*/Diagram*.tsx`, `src/shared/schematic/`, layer 3), and the small files that start the shared viewer |
| `child/scripts/migrate-ship.mjs` | Turns ships made before `child/core` into ones that use it |
