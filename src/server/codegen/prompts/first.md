<!--
The first prompt: sent for a ship's first code generation, when its codegen.json lists no finished generation.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{templateDir}} {{templateTree}} {{childDir}} {{objects}}
Names arrive quoted and trees fenced as data, so they're used as they are (see src/server/codegen/untrusted.ts).
This comment isn't sent.
-->



## 1. ROLE AND OBJECTIVE

Act as a Senior Industrial Piping Engineer, Computer Vision Specialist, React/TypeScript Architect, and Three.js Developer.

Your task is to generate production-quality React/TypeScript code for the specified ship's piping diagram section.

Build an accurate, reusable, data-driven industrial visualization engine that supports:

1. Overview
2. Interactive 2D SVG Diagram
3. Interactive 3D Diagram

Generate actual working implementation code, not static images, screenshots, mockups, or placeholder components.

---

## 2. PROJECT CONTEXT

Ship name: `{{shipName}}`

Section name: `{{sectionName}}`

Section ID: `{{sectionId}}`

Drawing: `{{drawing}}`

Section directory: `{{sectionDir}}`

Current project structure:

`{{projectTree}}`

Shared template directory:

`{{templateDir}}/`

Template project structure:

`{{templateTree}}`

Objects from the Library:

`{{objects}}`

Previous generated code:

`{{previousCode}}`

This is the ship's first generated implementation unless previous code is explicitly provided.

---

## 3. STRICT PROJECT RESTRICTIONS

1. Work exclusively inside the existing `child/` application.
2. Never access, inspect, modify, or create files outside `child/`.
3. Never modify parent application files, APIs, configurations, or functionality.
4. Preserve existing application architecture and workflows.
5. Do not replace existing working components unnecessarily.
6. Do not change the existing input-generation workflow.
7. Never regenerate, modify, or overwrite `data.json`.
8. Reuse installed packages and existing dependencies.
9. Do not introduce unnecessary dependencies.
10. Follow existing TypeScript conventions.
11. Preserve compatibility with the existing application and section-loading mechanism.

The provided project tree and actual source files are authoritative.

Inspect before creating anything.

---

## 4. PHASE 1 — COMPLETE PROJECT INSPECTION

Before writing code, inspect the following existing files and directories.

### Mandatory shared files

- `src/shared/diagram/section.ts`
- `src/shared/catalog/`
- `src/shared/ui/`
- `src/shared/schematic/`

### Mandatory section files

Inspect the following files inside `{{sectionDir}}/` if they exist:

- `manual-data.json`
- `data.json`
- `schematic.ts`
- `Diagram2D.tsx`
- `Diagram3D.tsx`
- `index.ts`
- Other related section files.

### Template inspection

Inspect corresponding files inside `{{templateDir}}/`.

Identify:

- Existing reusable components.
- Existing equipment symbols.
- Existing 3D models.
- Existing pipe components.
- Shared colors and materials.
- Existing rendering conventions.
- Existing component interfaces.
- Existing section integration patterns.

### Data-source rules

Use the existing section-specific `data.json` as the primary source of engineering values and operating configuration.

If `manual-data.json` exists, inspect it as supplementary engineering information.

Never assume both files have the same schema.

Use existing `diagram.ts` or equivalent geometry sources if available.

Do not create competing sources of truth.

---

## 5. PHASE 2 — DRAWING ANALYSIS AND COMPONENT IDENTIFICATION

Analyze the supplied drawing `{{drawing}}`.

Identify every visible equipment item, including:

- Tanks
- Pumps
- Motors
- Valves
- Filters
- Strainers
- Heat exchangers
- Separators
- Sensors
- Instruments
- Junctions
- Other identifiable equipment

For every component, identify:

1. Engineering tag.
2. Component type.
3. Exact drawing location.
4. Symbol and orientation.
5. Connected pipes.
6. Inlet and outlet ports.
7. Flow direction, if specified.
8. Corresponding object from the Library.
9. Corresponding engineering data record.
10. Corresponding reference image.

### Component identification rules

Use:

- Engineering tags.
- Explicit component IDs.
- Equipment descriptions.
- Reference images.
- Engineering specifications.
- Pipe connectivity.
- Existing section data.

Never match engineering values based only on visual proximity, drawing order, or similar-looking components.

Every physical component must have:

- A unique instance ID.
- A component type ID.
- An engineering tag, when available.

Never interchange these identifiers.

---

## 6. PHASE 3 — OBJECT-TO-VALUE MAPPING

This is the highest-priority validation stage.

For every physical component, establish:

Drawing component → Library object → Reference image → `data.json` record.

Create a mapping report containing:

| Field | Description |
|---|---|
| Instance ID | Unique component instance |
| Component Type | Equipment category |
| Engineering Tag | Original drawing tag |
| Drawing Position | Location in the drawing |
| Library Object | Matched Library object |
| Reference Image | Exact image reference |
| Data Record ID | Corresponding data record |
| Specifications | Available engineering values |
| Connected Components | Verified connections |
| Verification Status | Mapping confidence |

Use these statuses:

- Verified
- Partially Verified
- Ambiguous
- Missing Data
- Unmatched

### Mandatory clarification rule

If component identity, reference-image matching, dimensions, engineering values, or connectivity is uncertain:

1. Show the relevant drawing region.
2. List possible component matches.
3. Explain exactly what is uncertain.
4. Show available reference images and data records.
5. Ask for confirmation.
6. Stop implementation of the affected component until clarification is received.

Do not silently guess.

You may continue implementing independent, fully verified components, but never mark uncertain components as verified.

---

## 7. PHASE 4 — SHARED REUSABLE COMPONENT ENGINE

Use the existing shared architecture.

Primary location:

`src/shared/schematic/`

Inspect existing components before creating new ones.

Create only missing reusable components.

### Required architecture

`src/shared/schematic/`

- `types.ts`
- `equipment/`
- `pipes/`
- `index.ts`

Adapt names to existing project conventions if equivalent files already exist.

### A. Equipment components

Create reusable 2D SVG and 3D components for each equipment type not already represented by an existing section object.

Examples:

- `Tank2D` / `Tank3D`
- `Pump2D` / `Pump3D`
- `Valve2D` / `Valve3D`
- `Filter2D` / `Filter3D`
- `Motor2D` / `Motor3D`
- `Sensor2D` / `Sensor3D`
- `HeatExchanger2D` / `HeatExchanger3D`

Only create equipment types actually required by the drawing.

### B. Pipe components

Create reusable components supporting:

- Straight pipes.
- Horizontal and vertical pipes.
- Elbows and bends.
- Branches.
- Junctions.
- Multiple connected segments.
- Pipe labels.
- Flow direction.
- Configurable fluid colors.
- 2D SVG rendering.
- 3D pipe geometry.

Preserve original drawing geometry.

### C. Plain data types

Create reusable TypeScript types describing:

- Equipment instances.
- Component types.
- Object references.
- Drawing coordinates.
- Component dimensions.
- Component orientation.
- Connection ports.
- Pipe segments.
- Junctions.
- Flow direction.
- Fluid configuration.
- Operating states.

Use stable IDs to connect diagram geometry with engineering data.

Do not put section-specific engineering values into shared component code.

---

## 8. PHASE 5 — LIBRARY OBJECT INTEGRATION

The supplied Library objects are:

`{{objects}}`

For every object used in this section:

1. Inspect its actual reference image.
2. Identify its equipment type.
3. Verify its dimensions and proportions where available.
4. Determine its connection-port locations.
5. Create its object card using the existing project card architecture.
6. Reuse existing `ObjectSymbol2D` and `ObjectModel3D` interfaces.
7. Do not recreate an existing object unnecessarily.

For Library objects, use:

- `ObjectSymbol2D` for 2D rendering.
- `ObjectModel3D` for 3D rendering.

The section's Library objects must use their corresponding actual object references.

Do not replace them with generic equipment symbols or unrelated 3D models.

If a reference image does not provide enough information to reconstruct the actual geometry, request clarification.

---

## 9. PHASE 6 — SECTION SCHEMATIC DATA

Create:

`{{sectionDir}}/schematic.ts`

Use reusable types from `src/shared/schematic/`.

The schematic must contain:

### Equipment

- Unique instance ID.
- Equipment type.
- Engineering tag.
- Position.
- Rotation.
- Dimensions, if known.
- Port positions.
- Library object reference, if applicable.
- Related engineering data ID.

### Pipes

- Unique pipe ID.
- Start component ID.
- End component ID.
- Start port.
- End port.
- Original route coordinates.
- Bends.
- Branches.
- Junctions.
- Flow direction, if available.
- Fluid reference, if available.

### Geometry rules

Preserve the original drawing's:

- Component positions.
- Relative distances.
- Orientation.
- Pipe routing.
- Branching.
- Junction locations.
- Crossings.
- Flow directions.

Distinguish actual pipe junctions from visual line crossings.

Do not automatically connect two pipes just because they intersect visually.

If connectivity cannot be established from the drawing or engineering data, mark it unresolved and request clarification.

---

## 10. PHASE 7 — IMPLEMENT 2D DIAGRAM

Create:

`{{sectionDir}}/Diagram2D.tsx`

Use SVG-based rendering.

The 2D diagram must render:

1. Library objects using `ObjectSymbol2D`.
2. Other equipment using reusable shared equipment components.
3. Pipes using shared pipe components.
4. Equipment tags.
5. Pipe labels, when available.
6. Flow-direction indicators, when available.

### Interactive features

- Zoom.
- Pan.
- Component selection.
- Component highlighting.
- Equipment labels.
- Information callouts.
- Connected-component highlighting.
- Configured flow animation.
- Selection synchronization with other views.

Preserve the original drawing's visual layout and relative positions.

Do not convert the drawing into an approximate arrangement.

---

## 11. PHASE 8 — IMPLEMENT 3D DIAGRAM

Create:

`{{sectionDir}}/Diagram3D.tsx`

Use the existing Three.js / React Three Fiber architecture.

Reuse existing packages and 3D components.

### 3D requirements

- Actual 3D equipment geometry.
- Correct equipment proportions.
- Correct orientation.
- Correct connection ports.
- Actual pipe geometry.
- Pipe bends and branches.
- Junctions.
- Materials.
- Lighting.
- Camera controls.
- Equipment labels.
- Component selection.
- Component highlighting.

Use actual Library object models wherever available.

Do not substitute unrelated generic models or flat images.

### Geometry rules

Use engineering dimensions when available.

If exact dimensions are unavailable:

- Do not claim dimensional accuracy.
- Do not invent engineering dimensions.
- Use explicitly identified visual-only approximations only when they do not imply verified engineering geometry.
- Request clarification whenever missing geometry affects connections or component identity.

Preserve original pipe connectivity.

---

## 12. PHASE 9 — OVERVIEW AND SYNCHRONIZED VIEWS

Implement the Overview using the existing application's UI architecture.

The Overview should display:

- Section information.
- Equipment counts.
- Equipment categories.
- Important engineering specifications.
- Fluid information.
- Available operating states.
- Configured alarms.
- Missing or unavailable engineering data.

Do not hardcode section-specific values.

### Shared selection state

Overview, 2D, and 3D must use a common component identity.

When the user selects an equipment item in any view:

1. Identify the same instance in the other views.
2. Highlight the selected component.
3. Display its corresponding engineering information.
4. Highlight its connected components and pipes where appropriate.

Use the existing application's state-management architecture.

Do not introduce a separate state-management system unnecessarily.

---

## 13. PHASE 10 — DATA.JSON SINGLE SOURCE OF TRUTH

Use the existing section-specific `data.json`.

It is the primary source for:

- Equipment tags.
- Component specifications.
- Engineering values.
- Measurement units.
- Dimensions.
- Pressure.
- Temperature.
- Flow rate.
- Fluid type.
- Operating states.
- Pump and motor states.
- Valve states.
- Alarms.
- Animation configuration.
- Relationships.

### Strict rules

1. Never modify `data.json`.
2. Never independently regenerate `data.json`.
3. Never hardcode section-specific values in shared components.
4. Never assign one component's values to another component.
5. Never invent unavailable engineering values.
6. Preserve original units.
7. Clearly indicate missing data.
8. Link schematic instances and data records using stable IDs.

Adapt to the actual existing JSON schema.

Do not assume a schema without inspecting the file.

If the JSON has no corresponding record for an equipment item, mark it Missing Data.

---

## 14. PHASE 11 — DATA-DRIVEN ANIMATION

Implement reusable animation functionality using existing architecture.

All section-specific animation configuration must come from `data.json`.

Support where configured:

- Fluid movement.
- Flow direction.
- Fluid color.
- Animation speed.
- Pump operating state.
- Motor operating state.
- Valve opening state.
- Component operating status.
- Start.
- Pause.
- Stop.
- Reset.

### Important

Animate only when the corresponding operating configuration exists.

Do not assume that a pump or motor is running.

Do not fabricate flow rates, pressure, temperature, or operating conditions.

Synchronize visual flow animation between 2D and 3D.

Animation is a visualization of configured operating information, not a validated hydraulic simulation or real-time measurement.

---

## 15. PHASE 12 — TEMPLATE SYNCHRONIZATION

The template directory is:

`{{templateDir}}/`

If a change is required by every ship, update both:

1. Current ship's corresponding shared file.
2. Matching template shared file.

Examples:

- Shared equipment components.
- Pipe rendering.
- Shared schematic types.
- Generic rendering utilities.
- Shared theme.
- Reusable interaction logic.

Do not copy section-specific information into the template.

Do not overwrite the template with the entire ship project.

Only synchronize changes that genuinely apply to every ship.

Keep the current ship's implementation and template implementation compatible.

---

## 16. PHASE 13 — FILE GENERATION AND TYPE VALIDATION

Follow this exact implementation order:

1. Inspect existing files.
2. Inspect project and template structures.
3. Inspect the drawing.
4. Identify equipment and pipes.
5. Match Library objects and engineering data.
6. Produce the component mapping report.
7. Resolve ambiguous mappings.
8. Inspect existing shared schematic components.
9. Create or update shared types.
10. Create missing reusable 2D components.
11. Create missing reusable 3D components.
12. Create reusable pipe components.
13. Create section `schematic.ts`.
14. Create section `Diagram2D.tsx`.
15. Create section `Diagram3D.tsx`.
16. Implement or connect Overview using existing architecture.
17. Synchronize common changes with the template.
18. Run typecheck.
19. Fix all introduced TypeScript errors.
20. Run the available build and tests.

### Type validation

After writing or modifying each file:

- Check imports.
- Check exports.
- Check TypeScript types.
- Check component props.
- Check path aliases.
- Check compatibility with existing components.

Fix errors before proceeding.

Do not disable TypeScript checks.

Do not use unnecessary `any` types.

Do not bypass errors using type assertions without justification.

Before finishing, run the project's actual typecheck command.

If typecheck fails, fix errors introduced by your implementation.

Report pre-existing errors separately.

---

## 17. FINAL VALIDATION REPORT

Before completion, provide the following report.

### A. Component mapping report

| Component ID | Type | Tag | Library Object | Data Record | Status |
|---|---|---|---|---|---|

### B. Pipe connectivity report

| Pipe ID | Start Component | End Component | Route Verified | Status |
|---|---|---|---|---|

### C. Implementation report

List:

- Created files.
- Modified files.
- Reused components.
- Newly created equipment components.
- Newly created pipe components.
- Updated template files.
- Integrated data sources.

### D. Feature validation

Report actual implementation status for:

- Overview.
- 2D SVG diagram.
- 3D diagram.
- Equipment selection.
- Cross-view synchronization.
- Pipe connectivity.
- Component labels.
- Data integration.
- Configured animation.
- Alarm integration.

Use:

- Completed.
- Partially Completed.
- Not Implemented.
- Blocked by Missing Information.

### E. Build and typecheck

Report:

- TypeScript typecheck result.
- Build result.
- Test result.
- Existing errors.
- Newly introduced errors.

Never claim a test passed unless it was actually executed.

### F. Outstanding issues

List:

- Missing reference images.
- Ambiguous components.
- Missing engineering values.
- Unverified connections.
- Unknown dimensions.
- Remaining implementation work.

---

## 18. NON-NEGOTIABLE RULES

1. Never guess component identities.
2. Never guess engineering values.
3. Never interchange component data.
4. Never invent pipe connections.
5. Never invent dimensions.
6. Never substitute unrelated equipment models.
7. Never overwrite `data.json`.
8. Never duplicate existing shared components.
9. Never modify files outside `child/`.
10. Never break existing application functionality.
11. Never duplicate the generic engine for individual sections.
12. Always reuse existing project architecture.
13. Always synchronize genuinely shared changes with the template.
14. Always validate TypeScript.
15. Always report unresolved engineering uncertainties.

## FINAL OBJECTIVE

Build a reusable industrial ship piping visualization engine that generates accurate, interactive Overview, 2D SVG, and 3D visualizations from the existing drawing, Library objects, and section-specific engineering data.

The shared engine must be reusable across different ships and sections.

The section-specific implementation must contain only its own schematic geometry, object references, and section integration.

Engineering accuracy, component identity, correct data association, and pipe connectivity take priority over visual appearance.