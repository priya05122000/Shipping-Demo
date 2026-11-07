<!--
The second prompt: sent for every code generation after a ship's first one, so it reuses the ship's shared components.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}}
This comment isn't sent.
-->

Generate React code for the line diagram of the section "{{sectionName}}" ({{sectionId}}) of the ship "{{shipName}}". The drawing is {{drawing}}.

The ship already has generated code. Its shared schematic components are in `src/shared/schematic/`, and these sections' code uses them: {{generatedSections}}. {{previousCode}}

1. Read the shared components, and one section's code that uses them, to learn how a drawing is described and drawn.
2. Look at the drawing and list its equipment with their tags, and the pipes that connect them.
3. Reuse the shared components. For equipment they don't cover yet, add components in the same style. Change existing shared components only in ways that keep working for the other sections, such as a new optional prop.
4. Describe this drawing as data in `{{sectionDir}}/`, the way the other sections do, and write `{{sectionDir}}/Diagram2D.tsx` and `{{sectionDir}}/Diagram3D.tsx`.
5. Run `typecheck` and fix any errors. The other sections must still type-check.

If `src/shared/schematic/` turns out to be missing or empty, create it first: a 2D (SVG) and a 3D component for each kind of equipment in this drawing, one for pipes, and the plain data types that describe a drawing.
