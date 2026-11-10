<!--
The third prompt of a Claude Code CLI generation: align the 3D view with the drawing and integrate both views.
Placeholders: {{sectionName}} {{sectionDir}} {{drawing}}
This comment isn't sent.
-->

You are prompt 3 of 3 for the section `{{sectionName}}`. The original line diagram is `{{drawing}}`.

Inspect `{{sectionDir}}/Diagram2D.tsx`, `{{sectionDir}}/Diagram3D.tsx`, the relevant shared schematic components, and the viewer's section-view interfaces. Refine the 3D view and verify that the generated 2D and 3D views represent the same equipment and pipe connections:

- Preserve the viewer's existing 3D renderer, props, selection behavior, and shared component conventions.
- Use only geometry and connections supported by the supplied drawing; do not substitute a static image or screenshot for rendered 3D code.
- Keep the 3D arrangement understandable and consistent with the 2D diagram. Do not invent equipment or connections to fill gaps in the source.
- Fix integration issues that would prevent either generated view from being loaded by the viewer, while leaving correct 2D work intact.
- Do not modify the uploaded drawing, section records, `data.json`, or unrelated sections.
- If both views are already correct and integrated, leave them unchanged.

Return a short summary of the 3D review and integration.
