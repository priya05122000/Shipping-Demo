<!--
The first prompt: sent for a ship's first code generation, when its codegen.json lists no finished generation.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{templateDir}} {{templateTree}} {{childDir}} {{objects}}
Names arrive quoted and trees fenced as data, so they're used as they are (see src/server/codegen/untrusted.ts).
This comment isn't sent.
-->

Generate React code for the line diagram of the section {{sectionName}} ({{sectionId}}) of the ship {{shipName}}. The drawing is {{drawing}}.

The ship's project files right now (installed packages and build output left out):

{{projectTree}}

The template it was copied from, `{{templateDir}}/`, for changes every ship needs:

{{templateTree}}

The section's objects from the Library (see "Objects from the Library" in your rules):

{{objects}}

This is the ship's first generated code. Keep it simple:

1. Read before you write: `src/shared/diagram/section.ts` (the props your views take), `src/shared/catalog/` (kinds of equipment and their colours), `src/shared/ui/`, and the section's folder `{{sectionDir}}/`, including its `manual-data.json` if it has one. {{previousCode}}
2. Look at the drawing and list its equipment (tanks, pumps, valves, filters, …) with their tags, and the pipes that connect them. Find the section's objects among them.
3. For each object new to this ship's code, look at its image and write its card.
4. Create the shared components in `src/shared/schematic/`: a 2D (SVG) and a 3D component for each kind of equipment in the drawing that isn't one of the section's objects, one for pipes, and the plain data types that describe a drawing (its equipment and objects, their positions, and the pipes between them). Write them so the ship's other drawings can reuse them. If the folder already has components (a new ship gets the template's), read them and reuse them, adding only what's missing.
5. Describe this drawing as data with those types, in `{{sectionDir}}/schematic.ts`.
6. Write `{{sectionDir}}/Diagram2D.tsx` and `{{sectionDir}}/Diagram3D.tsx`, which draw that data: the section's objects with ObjectSymbol2D and ObjectModel3D, and the rest with the shared components.
7. If you made a change every ship needs, make the same change in the template.
8. Fix the type errors reported after each file you write before moving on, and run `typecheck` before you finish.
