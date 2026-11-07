<!--
The first prompt: sent for a ship's first code generation, when its codegen.json lists no finished generation.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}}
This comment isn't sent.
-->

Generate React code for the line diagram of the section "{{sectionName}}" ({{sectionId}}) of the ship "{{shipName}}". The drawing is {{drawing}}.

This is the ship's first generated code, so there are no shared schematic components yet. Keep it simple:

1. Look at the drawing and list its equipment (tanks, pumps, valves, filters, …) with their tags, and the pipes that connect them.
2. Create the shared components in `src/shared/schematic/`: a 2D (SVG) and a 3D component for each kind of equipment in the drawing, one for pipes, and the plain data types that describe a drawing (its equipment, their positions, and the pipes between them). Write them so the ship's other drawings can reuse them.
3. Describe this drawing as data with those types, in `{{sectionDir}}/schematic.ts`.
4. Write `{{sectionDir}}/Diagram2D.tsx` and `{{sectionDir}}/Diagram3D.tsx`, which draw that data with the shared components.
5. Run `typecheck` and fix any errors.
