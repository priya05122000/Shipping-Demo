<!--
Later-generation task for a ship that already has generated sections.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{codeDir}} {{version}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{coreDir}} {{coreTree}} {{childDir}} {{objects}}
This comment is not sent.
-->

# Add a piping diagram section

Create a new section for ship {{shipName}} named {{sectionName}} (ID {{sectionId}}) from the supplied drawing: {{drawing}}.

This is version {{version}} of the section's code. Generate all of it inside the section, in its version folder `{{codeDir}}/`.

## 1. Inspect Existing Architecture

Before coding, inspect the ship's actual files and folder structure. Use the project tree and prior-generation context to locate existing sections, then read at least one representative existing piping section in full: a generated section's code in use is in its version folder (listed below). Prefer the most recently generated section that uses shared code. Inspect its section files, schematic/geometry, 2D and 3D views, object references, and any relevant `src/shared/schematic/` components. Also inspect the target section folder and its `section.json`, drawing, `manual-data.json`, and the version folder `{{codeDir}}/` with any code already copied into it.

Use the existing ship section as the pattern for folder structure, imports, component reuse, styling, types, and viewer integration. Reuse and extend the ship's established shared code when appropriate. Do not start from a generic design or copy the sample ship blindly. Keep section-specific geometry, identities, and engineering facts grounded in this new section's drawing and records; do not copy values or connections from another section.

Ship sections and prior code context:

- Existing generated sections: {{generatedSections}}
- Previous generated code: {{previousCode}}
- Ship project structure: {{projectTree}}
- Target section: `{{sectionDir}}/`
- This version's code folder (write the section's code here): `{{codeDir}}/`

## Inspect the shared viewer and available objects

The shared viewer (`{{coreDir}}/`, `@shipdocs/viewer-core`) is read-only. Read its relevant exported APIs and types to understand how the existing ship section uses them. Follow the actual `package.json` exports, existing core architecture, styles, and component contracts. Do not copy or modify core files.

Inspect the Library objects supplied for this section, their cards, and their available assets before matching them to drawing components:

{{objects}}

Shared viewer structure: {{coreTree}}

Other ship projects are available for read-only reference under `{{childDir}}/`; use them only if this ship has no useful precedent.

## 2. Preserve Engineering Data

- Treat `manual-data.json` as read-only. Use its component records through the viewer's supported data-loading behavior when displaying engineering details or using supported calculations and flow simulation.
- Match each schematic part's `component` to the correct `manual-data.json` record ID using the exact engineering tag and verified evidence. Do not transfer values or connections from other sections, alter records, or invent values, dimensions, operating states, relationships, or pipe connections. Leave unavailable information unknown and report ambiguity.

## 3. Preserve Existing Application Functionality

Add only the new section and necessary backward-compatible ship-level shared code. Reuse the existing viewer, shared schematic components, styles, object integrations, and interaction behavior. Keep existing sections, project configuration, `src/custom/`, the shared viewer, and parent-child communication unchanged. Do not duplicate viewer features or introduce unnecessary dependencies.

## Implement the new section

Follow the existing ship section's working pattern and the shared viewer's intended extension points. If the ship uses the core piping engine, use its established schematic and 2D/3D view pattern. Reuse the viewer's rendering, styling, overview, details, selection, and interactions instead of building duplicate functionality.

Trace the new drawing's equipment, tags, layout, pipes, branches, junctions, crossings, and flow directions. Match components to engineering records and Library objects using tags and evidence. Keep all views backed by the same section data and geometry. Add or update ship-level shared code only when needed, and preserve compatibility with the ship's existing sections and every earlier version of them.

End every free pipe end with a ring or a joinable flanged (`cap`) end fitting, as the shared rules describe. No plain pipe ends.

## Constraints

- Write only the new section's necessary generated files, in `{{codeDir}}/`, and, when needed, reusable code under this ship's `src/shared/schematic/`. Never change the section's earlier version folders.
- Do not modify the shared viewer, ship configuration, `src/custom/`, uploaded assets, Library-owned files, or unrelated sections.
- Do not edit or directly import `manual-data.json` into generated code.
- Do not guess component identities, dimensions, specifications, operating states, or pipe connections. Report uncertainty and leave dependent work unresolved when evidence is insufficient.
- Follow the actual APIs, types, styling, and folder conventions you inspected. Do not add dependencies or duplicate existing core features.

## 4. Test and Validate after Every File Creation

Work incrementally. After creating or modifying each file, check its paths, imports, exports, types, and compatibility with the existing ship. Run the narrowest relevant check available and fix any errors introduced before creating the next file. After all changes, run the ship's documented typecheck. Run a build only when its outputs stay within the permitted ship project. Record checks that could not be run as not tested.

## Finish

Check affected files for type and import errors. Run documented typecheck/build commands only when their outputs stay within the permitted ship project. Report what existing section patterns and shared components you reused, files created or changed, unresolved engineering/connectivity questions, and actual validation results. Do not claim checks passed unless you ran them.
