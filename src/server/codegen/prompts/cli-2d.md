<!--
The second prompt of a Claude Code CLI generation: review the generated 2D view against the source drawing.
Placeholders: {{sectionName}} {{sectionDir}} {{drawing}}
This comment isn't sent.
-->

You are prompt 2 of 3 for the section `{{sectionName}}`. The original line diagram is `{{drawing}}`.

Review the line diagram and the current `{{sectionDir}}/Diagram2D.tsx`. Read the existing section and shared schematic files this view uses before changing them. Then refine the 2D view so it accurately represents the supplied drawing:

- Preserve the existing viewer interfaces and shared components.
- Keep the diagram scalable, legible, and interactive, with equipment and pipe connections in positions supported by the drawing.
- Keep component identity and connections consistent; do not invent tags, equipment, or pipe routes that cannot be read from the drawing.
- Prefer improving the section's `Diagram2D.tsx`; change shared files only when the improvement genuinely benefits the shared 2D renderer.
- Do not modify the uploaded drawing, section records, `data.json`, or unrelated sections.
- If the existing 2D view is already correct, leave it unchanged.

Return a short summary of the 2D review.
