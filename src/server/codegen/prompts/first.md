<!--
First-generation task for a ship with no completed code generation.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{coreDir}} {{coreTree}} {{childDir}} {{objects}}
This comment is not sent.
-->

# Add a piping diagram section

Create a new section for ship {{shipName}} named {{sectionName}} (ID {{sectionId}}) from the supplied drawing: {{drawing}}.

## Before coding

Inspect the actual files and folder structure. Use the supplied project tree as a starting point, not as proof that a file exists.

- Read the target section folder `{{sectionDir}}`, including `section.json`, the drawing, any existing `manual-data.json`, and generated files.
- Read the sample ship's piping section and its `schematic.ts`, `Diagram2D.tsx`, and `Diagram3D.tsx` to follow the working folder layout and coding style.
- Read the relevant exports and implementation in the shared viewer `{{coreDir}}/`, especially `@shipdocs/viewer-core/pipeline`, `@shipdocs/viewer-core/pipeline/3d`, `@shipdocs/viewer-core/diagram`, and the object APIs used by the sample.
- Inspect and use the Library objects selected/uploaded for this section in its `src/objects/` folders. Match the section's `section.json` `objectIds` and the supplied object cards/assets: {{objects}}. Prefer these actual objects over generic substitutes.
- Check the ship's shared schematic folder for an existing Library object index (use `src/shared/schematic/object-index.md` if no established index exists). Reuse it if present; do not create a duplicate.
- Review the ship's existing sections, shared schematic code, and customizations where present: {{projectTree}}

## Analyze the Engineering Drawing

Before implementing, identify the equipment and tags, Library objects, pipe routes and line identifiers, branches, junctions, crossings, port connections, orientations, and specified flow directions. Preserve the drawing's layout and distinguish real connections from visual crossings. Map components to `manual-data.json` records by exact engineering tag and use only supported evidence. Mark missing or ambiguous information as unknown; do not guess.

## Build a Reusable Shared Engine if Working on Core

Reuse the existing shared viewer as the engine for this section. Do not rebuild its rendering, overview, selection, data loading, calculations, or flow simulation. If the drawing needs reusable functionality the viewer does not provide, add only the necessary backward-compatible ship-level code under `src/shared/schematic/` so future sections can reuse it. The shared viewer at `{{coreDir}}/` is read-only; never modify or copy it.

## Implement the Section

Follow the existing core architecture and the sample ship. The shared viewer already provides the piping diagram engine, styling, overview, selection, details, and 2D/3D rendering. Add a section that uses these existing features; do not build another viewer or copy core files into the ship.

For a piping section, follow the sample's pattern:

- `schematic.ts` defines the drawing with `definePipeline` from `@shipdocs/viewer-core/pipeline`.
- `Diagram2D.tsx` renders that schematic with `PipelineView2D`.
- `Diagram3D.tsx` renders the same schematic with `PipelineView3D` from `@shipdocs/viewer-core/pipeline/3d`.
- Reuse the section's Library objects and existing viewer styles and interactions.

Use the section's `manual-data.json` records for available component names, specifications, operating status, troubleshooting details, and other values the viewer displays. Match each schematic part's `component` field to the exact engineering record `id`; the shared pipeline viewer loads and uses this file. Build the schematic's pipe network, part-to-pipe connections, valve starting positions, and system definitions from verified drawing/manual evidence so the core can calculate readings and trace/animate flow. Use the core's existing calculations and flow behavior; do not create a competing simulation or invent missing values.

Trace the drawing's layout, parts, pipe routes, branches, crossings, and connections. Assign the selected Library objects to the matching parts using their actual object IDs, tags, kinds, and connection points. Keep the 2D and 3D views backed by the same schematic. Add ship-level shared code only if the section needs reusable behavior that the core does not provide.

Update the existing ship-level object index if one was found. If none exists, create `src/shared/schematic/object-index.md`. Include every object supplied for this section, with its object ID, name, verified equipment kind/type, card description, aspect ratio, connection ports, known asset filenames, and the section(s) where it is used. Record only information present in the supplied object details/cards; mark unavailable fields unknown. Keep the index concise and use it as a reference for matching objects in future sections. Preserve existing entries and never edit uploaded images or object metadata.

## Follow Strict Project Restrictions

- Write only the new section's necessary generated files and, when needed, reusable code or the object index under this ship's `src/shared/schematic/`.
- Never modify `{{coreDir}}/`, ship configuration, `src/custom/`, uploaded assets, other sections, or Library-owned files.
- `manual-data.json` may be inspected as reference, but do not edit or import it directly into generated code. Do not invent engineering facts; preserve unknown values as unknown.
- Do not guess component identities, dimensions, specifications, flow states, or pipe connections. Clearly report uncertainty and leave dependent implementation unresolved when evidence is insufficient.
- Follow the actual exported APIs, types, styles, and conventions you inspected. Do not add dependencies or duplicate existing core features.

## Finish

Check the affected files for type and import errors. Run the ship's documented typecheck/build commands only when their outputs stay within the permitted ship project. Report the section files created, components and objects reused, engineering or connectivity uncertainties, and the actual validation results. Do not claim checks passed unless you ran them.

Project context:

- Target section: `{{sectionDir}}/`
- Shared viewer (read-only): `{{coreDir}}/`
- Other ship projects (read-only): `{{childDir}}/`
- Existing ship structure: {{projectTree}}
- Shared viewer structure: {{coreTree}}
- Existing generated sections: {{generatedSections}}
- Previous generated code, if any: {{previousCode}}
