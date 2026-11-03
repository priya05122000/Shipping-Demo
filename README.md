# Ship Docs: Document & Diagram Management

A three-tab admin UI for **Line Diagrams**, **Objects** (3D model + line diagram) and **Manuals** (PDF).
Built with Next.js (App Router), TypeScript and Tailwind CSS. Records and uploaded files are saved to a **local `data/` folder** on the machine running the app. There's no database and no cloud.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

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
