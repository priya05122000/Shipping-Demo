<!--
The second prompt: sent for every code generation after a ship's first one, so it reuses the ship's shared components.
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

The ship already has generated code. Its shared schematic components are in `src/shared/schematic/`, and these sections' code uses them: {{generatedSections}}. {{previousCode}}

1. Read before you write: the shared components in `src/shared/schematic/`, one section's code that uses them, `src/shared/diagram/section.ts` (the props your views take), and the section's folder `{{sectionDir}}/`, including its `manual-data.json` if it has one. Learn from them how a drawing is described and drawn.
2. Look at the drawing and list its equipment with their tags, and the pipes that connect them. Find the section's objects among them: place the ones you know from their cards with their aspect and connection points, without their images.
3. For each object new to this ship's code, look at its image and write its card.
4. Reuse the shared components for the equipment that isn't one of the section's objects. For equipment they don't cover yet, add components in the same style. Change an existing shared component with Edit, based on what's in it now, and only in ways that keep working for the other sections, such as a new optional prop.
5. Describe this drawing as data in `{{sectionDir}}/`, the way the other sections do, and write `{{sectionDir}}/Diagram2D.tsx` and `{{sectionDir}}/Diagram3D.tsx`: the section's objects with ObjectSymbol2D and ObjectModel3D, and the rest with the shared components.
6. If you made a change every ship needs, make the same change in the template.
7. Fix the type errors reported after each file you write before moving on, and run `typecheck` before you finish. The other sections must still type-check.

If `src/shared/schematic/` turns out to be missing or empty, create it first: a 2D (SVG) and a 3D component for each kind of equipment in this drawing that isn't one of the section's objects, one for pipes, and the plain data types that describe a drawing.
