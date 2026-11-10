import { lazy } from "react";
import type { SectionFiles, SectionMeta } from "../manifest";
import type { SharedObject } from "../objects/registry";
import type { Section, SectionView } from "../shared/diagram";
import { byCreation, fileUrl, folderOf } from "../shared/records";

/*
 * Each section is a folder in the ship's src/sections, created from the Library (the parent app) and named from the
 * section's name, holding:
 *   section.json   ID, name, files and the IDs of the ship's objects it uses (written by the Library)
 *   one line diagram image and one manual (PDF), uploaded in the Library
 *   diagram.ts     optional: hotspots, as `export default defineDiagram({...})` (from @shipdocs/viewer-core/diagram)
 *   data.json      optional: details per hotspot item ID
 *   Diagram2D.tsx, Diagram3D.tsx
 *                  optional: the 2D and 3D views generated from the line diagram by Ship Docs (with AI), each
 *                  default-exporting a component that takes SectionViewProps. Shared parts are in the ship's
 *                  src/shared/schematic.
 * Folders are found automatically (see ../manifest.ts): adding, changing or removing one updates the viewer.
 */

/**
 * One lazy component per view file (by its glob key), so a hot update of the ship's data (a section added or renamed)
 * doesn't remount the views that were already showing. A view file's own changes are hot updates of that file.
 */
const lazyViews = new Map<string, SectionView>();

function lazyView(views: SectionFiles["views2d"], key: string): SectionView | undefined {
  const load = views[key];
  if (!load) return undefined;
  let view = lazyViews.get(key);
  if (!view) {
    // Not loaded up front: each view is its own chunk, loaded when it's first shown, so three.js only loads for a 3D view.
    view = lazy(load);
    lazyViews.set(key, view);
  }
  return view;
}

/** Every drawing the viewer can show, in menu order (oldest first, as in the Library). */
export function buildSections(files: SectionFiles, objects: SharedObject[]): Section[] {
  const { metas, urls, diagrams, details, views2d, views3d } = files;
  return Object.entries(metas)
    .map(([key, meta]: [string, SectionMeta]) => {
      const folder = folderOf(key);
      return { id: meta.id ?? folder, folder, createdAt: meta.createdAt, meta };
    })
    .sort(byCreation)
    .map(({ id, folder, meta }) => ({
      id,
      title: meta.name ?? folder,
      image: fileUrl(urls, folder, meta.lineDiagram),
      manual: fileUrl(urls, folder, meta.manual),
      diagram: diagrams[`./${folder}/diagram.ts`],
      data: details[`./${folder}/data.json`] ?? { items: {} },
      // An ID whose object was removed (e.g. by hand) is skipped.
      objects: (Array.isArray(meta.objectIds) ? meta.objectIds : []).flatMap(
        (objectId) => objects.find((object) => object.id === objectId) ?? [],
      ),
      view2d: lazyView(views2d, `./${folder}/Diagram2D.tsx`),
      view3d: lazyView(views3d, `./${folder}/Diagram3D.tsx`),
      codeVersion: typeof meta.codegenVersion === "number" ? meta.codegenVersion : undefined,
    }));
}
