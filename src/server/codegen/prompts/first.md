<!--
First-generation task for a ship with no completed code generation.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{coreDir}} {{coreTree}} {{childDir}} {{objects}}
This comment is not sent.
-->

# Add a piping diagram section

Create a new section for ship {{shipName}} named {{sectionName}} (ID {{sectionId}}) from the supplied drawing: {{drawing}}.

## Before coding

Inspect the actual files and folder structure. Use the supplied project tree as a starting point, not as proof that a file exists.

- Read the target section folder `{{sectionDir}}`, including `section.json`, the drawing, any existing `manual-data.json`, and generated files. Do not open or use `data.json`.
- Read the sample ship's piping section and its `schematic.ts`, `Diagram2D.tsx`, and `Diagram3D.tsx` to follow the working folder layout and coding style.
- Read the relevant exports and implementation in the shared viewer `{{coreDir}}/`, especially `@shipdocs/viewer-core/pipeline`, `@shipdocs/viewer-core/pipeline/3d`, `@shipdocs/viewer-core/diagram`, and the object APIs used by the sample.
- Inspect the available Library objects and their cards/assets: {{objects}}
- Review the ship's existing sections, shared schematic code, and customizations where present: {{projectTree}}

## Implement

Follow the existing core architecture and the sample ship. The shared viewer already provides the piping diagram engine, styling, overview, selection, details, and 2D/3D rendering. Add a section that uses these existing features; do not build another viewer or copy core files into the ship.

For a piping section, follow the sample's pattern:

- `schematic.ts` defines the drawing with `definePipeline` from `@shipdocs/viewer-core/pipeline`.
- `Diagram2D.tsx` renders that schematic with `PipelineView2D`.
- `Diagram3D.tsx` renders the same schematic with `PipelineView3D` from `@shipdocs/viewer-core/pipeline/3d`.
- Reuse the section's Library objects and existing viewer styles and interactions.

Trace the drawing's layout, parts, pipe routes, branches, crossings, and connections. Match parts to engineering records and Library objects using tags and available evidence. Keep the 2D and 3D views backed by the same schematic. Add ship-level shared code only if the section needs reusable behavior that the core does not provide.

## Constraints

- Write only the new section's necessary generated files and, when needed, reusable code under this ship's `src/shared/schematic/`.
- Never modify `{{coreDir}}/`, ship configuration, `src/custom/`, uploaded assets, other sections, or Library-owned files.
- Do not read or use `data.json`. `manual-data.json` may be inspected as reference, but do not edit or import it directly into generated code. Do not invent engineering facts; preserve unknown values as unknown.
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
