<!--
Later-generation task for a ship that already has generated sections.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{coreDir}} {{coreTree}} {{childDir}} {{objects}}
This comment is not sent.
-->

# Add a piping diagram section

Create a new section for ship {{shipName}} named {{sectionName}} (ID {{sectionId}}) from the supplied drawing: {{drawing}}.

## First inspect this ship's existing sections

Before coding, inspect the ship's actual files and folder structure. Use the project tree and prior-generation context to locate existing sections, then read at least one representative existing piping section in full. Prefer the most recently generated section that uses shared code. Inspect its section files, schematic/geometry, 2D and 3D views, object references, and any relevant `src/shared/schematic/` components. Also inspect the target section folder and its `section.json`, drawing, `manual-data.json`, or generated files when present. Do not open or use `data.json`.

Use the existing ship section as the pattern for folder structure, imports, component reuse, styling, types, and viewer integration. Reuse and extend the ship's established shared code when appropriate. Do not start from a generic design or copy the sample ship blindly. Keep section-specific geometry, identities, and engineering facts grounded in this new section's drawing and records; do not copy values or connections from another section.

Ship sections and prior code context:

- Existing generated sections: {{generatedSections}}
- Previous generated code: {{previousCode}}
- Ship project structure: {{projectTree}}
- Target section: `{{sectionDir}}/`

## Inspect the shared viewer and available objects

The shared viewer (`{{coreDir}}/`, `@shipdocs/viewer-core`) is read-only. Read its relevant exported APIs and types to understand how the existing ship section uses them. Follow the actual `package.json` exports, existing core architecture, styles, and component contracts. Do not copy or modify core files.

Inspect the Library objects supplied for this section, their cards, and their available assets before matching them to drawing components:

{{objects}}

Shared viewer structure: {{coreTree}}

Other ship projects are available for read-only reference under `{{childDir}}/`; use them only if this ship has no useful precedent.

## Implement the new section

Follow the existing ship section's working pattern and the shared viewer's intended extension points. If the ship uses the core piping engine, use its established schematic and 2D/3D view pattern. Reuse the viewer's rendering, styling, overview, details, selection, and interactions instead of building duplicate functionality.

Trace the new drawing's equipment, tags, layout, pipes, branches, junctions, crossings, and flow directions. Match components to engineering records and Library objects using tags and evidence. Keep all views backed by the same section data and geometry. Add or update ship-level shared code only when needed, and preserve compatibility with the ship's existing sections.

## Constraints

- Write only the new section's necessary generated files and, when needed, reusable code under this ship's `src/shared/schematic/`.
- Do not modify the shared viewer, ship configuration, `src/custom/`, uploaded assets, Library-owned files, or unrelated sections.
- Do not read or use `data.json`. `manual-data.json` may be inspected as reference, but do not edit or import it directly into generated code. Do not invent engineering facts.
- Do not guess component identities, dimensions, specifications, operating states, or pipe connections. Report uncertainty and leave dependent work unresolved when evidence is insufficient.
- Follow the actual APIs, types, styling, and folder conventions you inspected. Do not add dependencies or duplicate existing core features.

## Finish

Check affected files for type and import errors. Run documented typecheck/build commands only when their outputs stay within the permitted ship project. Report what existing section patterns and shared components you reused, files created or changed, unresolved engineering/connectivity questions, and actual validation results. Do not claim checks passed unless you ran them.
