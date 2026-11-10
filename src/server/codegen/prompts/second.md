<!--
The second prompt: sent for every code generation after a ship's first one, so it reuses the ship's shared components.
Placeholders: {{shipName}} {{sectionName}} {{sectionId}} {{sectionDir}} {{drawing}} {{generatedSections}} {{previousCode}} {{projectTree}} {{coreDir}} {{coreTree}} {{childDir}} {{objects}}
Names arrive quoted and trees fenced as data, so they're used as they are (see src/server/codegen/untrusted.ts).
This comment isn't sent.
-->


Generate and integrate a fully functional new industrial piping diagram section for the ship `{{shipName}}`, using the supplied line diagram and the existing generic application architecture.

The target section is `{{sectionName}}` (`{{sectionId}}`).

The drawing is: `{{drawing}}`

## PROJECT CONTEXT

### 1. Current Ship Project

The ship's project files (excluding installed packages and build output):

`{{projectTree}}`

### 2. Shared Viewer

The viewer every ship runs (`@shipdocs/viewer-core`): its UI, how it reads the ship's data, and the contracts your code builds on. It is read-only: people maintain it, and every ship picks up their changes when it is next built.

Shared viewer directory: `{{coreDir}}/`

Shared viewer structure:

`{{coreTree}}`

Import only what its `package.json` exports (`@shipdocs/viewer-core/diagram`, `/objects`, `/objects/model3d`, `/catalog`, `/data`, `/ui`). Reusable code for this ship goes in its own `src/shared/schematic/`.

### 3. Section Objects from the Library

The section's available objects from the Library (refer to the "Objects from the Library" instructions):

`{{objects}}`

### 4. Previously Generated Sections and Shared Components

The ship already has generated code.

Shared schematic components:

`src/shared/schematic/`

Previously generated sections that use these shared components:

`{{generatedSections}}`

Previous generated code and relevant implementation context:

`{{previousCode}}`

### 5. Target Section Directory

Section directory:

`{{sectionDir}}/`

---

# PHASE 1: INSPECT THE EXISTING APPLICATION BEFORE WRITING CODE

Do not start generating code immediately.

First, thoroughly inspect the existing application and understand its architecture.

Inspect the following:

### Existing project structure
- Existing sections and their folder structures.
- Section registration and loading mechanism.
- Component catalog and reference asset library.
- Shared 2D and 3D rendering systems.
- Existing themes, materials and styling.
- Data loaders and validation mechanisms.
- Animation and simulation systems.
- Component interactions, selection and highlighting.
- Overview interface and details panels.

### Mandatory files to inspect

Read and understand these files before implementing anything:

1. `src/shared/schematic/` — inspect all relevant shared schematic components.
2. At least one existing section's code that uses the shared components.
3. `{{coreDir}}/src/shared/diagram/section.ts` — understand the section props and interfaces (imported as `@shipdocs/viewer-core/diagram`).
4. `{{sectionDir}}/` — inspect the entire target section directory.
5. `{{sectionDir}}/manual-data.json` — inspect if it exists.
6. `{{sectionDir}}/data.json` — inspect the completed engineering data if it exists.
7. Existing `Diagram2D.tsx` and `Diagram3D.tsx` implementations from previously generated sections.
8. Existing section geometry, registration and data-loading files.
9. Existing component catalog and asset references.

Understand how the existing application describes, stores, loads and renders a piping diagram.

**Important:** The common engine is already developed. Your responsibility is to add a new section, not rebuild the application.

If `src/shared/schematic/` is missing or empty, create the necessary reusable architecture first, following the existing application's conventions wherever possible.

---

# PHASE 2: DRAWING ANALYSIS AND COMPONENT IDENTIFICATION

Carefully inspect the supplied line diagram.

Before implementing, identify and list:

- Every physical component.
- Engineering tag for every component.
- Component type.
- Pipe line numbers and identifiers.
- Pipe connections.
- Pipe branches and junctions.
- Flow directions.
- Component positions and orientations.
- Actual connections versus visual crossings.
- Any available dimensions and engineering specifications.

Create a component mapping between the drawing and the existing component catalog.

For every physical component, establish:

Diagram Component → Unique Instance ID → Component Type ID → Engineering Tag → Reference Image → data.json Record → Engineering Values → Pipe Connections.

Maintain the distinction between:

- Component Type ID: Identifies the type of equipment.
- Instance ID: Uniquely identifies a physical component in this section.
- Engineering Tag: Original tag shown in the engineering drawing.

Every physical component must have a unique instance ID.

## Component identification rules

Search the existing application and catalog before creating anything new.

Check:

- Existing component catalog.
- Reference images.
- Existing 2D symbols.
- Existing 3D models.
- Component materials.
- Existing shared rendering components.
- Objects available from the Library.

Reuse matching assets wherever possible.

Do not request, recreate or replace an image that already exists in the project.

### Object identification and verification

Use explicit identifiers, engineering tags, descriptions, specifications and relationships as evidence.

Never associate engineering values using:

- Visual proximity alone.
- Drawing order alone.
- Similar-looking component shapes.
- Assumptions based on component type.

Record the mapping status of every component as one of:

- Verified
- Partially Verified
- Ambiguous
- Missing Data
- Unmatched

If component identity, reference image, engineering values or connections are uncertain:

1. Show the component.
2. List possible matching catalog entries.
3. Show the available supporting evidence.
4. Explain what is uncertain.
5. Ask me to confirm the mapping.

**Never guess or silently implement an uncertain engineering mapping.**

Complete the verified mappings first. Stop implementation of any dependent component or connection until clarification is received.

---

# PHASE 3: REUSE EXISTING COMPONENTS AND ASSETS

Reuse existing components wherever suitable.

The existing shared rendering architecture must remain the primary rendering system.

## 3.1 Section Objects from the Library

For objects supplied in `{{objects}}`:

- Identify their corresponding objects in the drawing.
- Read their object cards and available metadata.
- Use their defined aspect ratio.
- Use their defined connection points.
- Use their defined component identity.
- Preserve their object geometry and orientation.
- Do not use their reference images as rendered backgrounds.
- Render them using the existing `ObjectSymbol2D` and `ObjectModel3D` mechanisms.

For every object that is new to the ship's code:

- Inspect its reference image.
- Understand its physical appearance.
- Identify its orientation and connection points.
- Create its corresponding object card using the established schema.
- Maintain consistent component identity across 2D and 3D.

Do not create duplicate object cards.

## 3.2 Equipment Outside the Library Objects

For equipment that is not represented by Library objects:

- Reuse existing shared schematic components.
- Reuse existing 2D symbols and 3D models.
- Reuse existing materials and rendering logic.
- Add new reusable components only when no suitable implementation exists.

If a new equipment type is required, create:

- Its 2D SVG representation.
- Its 3D representation.
- Its component data types, if required.
- Its connection points.
- Its rendering and interaction support.

Follow the existing component implementation style.

## 3.3 Shared Component Modifications

If an existing shared component needs improvement:

- Inspect its current implementation first.
- Modify it using the existing implementation as the baseline.
- Prefer backward-compatible optional props.
- Do not break previously generated sections.
- Do not remove existing functionality.
- Do not introduce section-specific hardcoding into shared components.

These are the ship's own shared components, in `src/shared/schematic/`. The common engine, the shared viewer `{{coreDir}}/`, is never modified: every ship runs it, and people maintain it.

If the section needs something the shared viewer doesn't provide, implement it in the ship, and describe the missing shared capability in your final report as a suggestion for people to add to the shared viewer.

---

# PHASE 4: ENGINEERING DATA AND COMPONENT MAPPING

The supplied completed `data.json` is the source of truth for section-specific engineering information.

Read the complete existing `data.json` and understand its schema.

**STRICT RULE: Never create, modify, overwrite, regenerate or replace the supplied `data.json`.**

Also preserve existing `manual-data.json` and use it as an additional source of engineering information when available.

Maintain the distinction between:

- Drawing geometry.
- Component identity.
- Engineering specifications.
- Component relationships.
- Pipe connectivity.
- Operating states.
- Fluid properties.
- Alarms.
- Animation configuration.

## Engineering data matching

For every component, verify:

- Component ID.
- Instance ID.
- Engineering tag.
- Component type.
- Nominal diameter.
- Material.
- Pressure rating.
- Operating pressure.
- Operating temperature.
- Flow rate.
- Flow direction.
- Dimensions.
- Connection type.
- Inlet and outlet ports.
- Connected pipe IDs.
- Related component IDs.

Verify values and units against the supplied engineering records.

Do not invent missing values, dimensions, pressure ratings, flow rates or relationships.

If a value is unavailable, preserve it as missing or unknown according to the existing schema.

Do not substitute values from another similar component.

Keep the supplied engineering records unchanged.

---

# PHASE 5: CREATE THE NEW SECTION

Create only the necessary section-specific files and register the new section through the application's existing section-loading mechanism.

Work exclusively inside `child/`.

Do not recreate the common engine.

Follow the existing folder structure and naming conventions.

## 5.1 Section Geometry and Connectivity

Keep `diagram.ts` responsible for:

- Component positions.
- Component dimensions.
- Component orientations.
- Pipe geometry.
- Pipe routing.
- Pipe branches.
- Pipe bends.
- Pipe junctions.
- Pipe-to-component port connections.
- Flow directions.
- Actual junctions versus visual crossings.

Keep the existing `data.json` responsible for section-specific:

- Engineering values.
- Specifications.
- Component relationships.
- Fluid properties.
- Operating states.
- Alarm configurations.
- Animation configurations.

Respect the application's existing schema.

Do not duplicate engineering values inside rendering components when they are already available through `data.json`.

## 5.2 Required Rendering Files

Create:

`{{sectionDir}}/Diagram2D.tsx`

`{{sectionDir}}/Diagram3D.tsx`

Both views must represent the same physical piping system.

### Diagram2D.tsx

Use:

- Existing shared 2D schematic components.
- `ObjectSymbol2D` for Library objects.
- Existing pipe-rendering components.
- Existing symbols and connection points.
- Existing selection and highlighting mechanisms.

Preserve:

- Original pipe routing.
- Component placement.
- Component dimensions.
- Pipe colors.
- Branches and bends.
- Junctions and crossings.
- Flow directions.
- Component orientations.

### Diagram3D.tsx

Use:

- Existing shared 3D components.
- `ObjectModel3D` for Library objects.
- Existing equipment models.
- Existing materials and lighting.
- Existing pipe-rendering mechanisms.
- Existing selection and highlighting mechanisms.

Maintain the same component records, instance IDs, positions, geometry and connections used by the 2D view.

Do not create separate component identities for 2D and 3D.

Both views must reference the same underlying component records.

## 5.3 Shared Schematic Architecture

Use the following existing directory:

`src/shared/schematic/`

Reuse the available shared components for all supported equipment.

If a new reusable component is essential, add it in the appropriate shared location and follow the established architecture.

If the shared schematic directory is missing or empty, establish the minimum reusable foundation required by this drawing:

- 2D SVG component for each unsupported equipment type.
- 3D component for each unsupported equipment type.
- Reusable pipe component.
- Plain data types describing a drawing.
- Consistent connection-point definitions.
- Reusable component interfaces.

Ensure that any new shared functionality remains compatible with existing sections.

---

# PHASE 6: PRESERVE THE COMMON ENGINE AND EXISTING FUNCTIONALITY

The following existing systems must remain intact:

- Overview interface.
- Component catalog.
- Reference asset library.
- Shared themes and materials.
- 2D renderer.
- 3D renderer.
- Animation system.
- Operating logic.
- Component selection.
- Component highlighting.
- Component interactions.
- Details panels.
- Callouts.
- Alarm handling.
- Existing section registration and loading.

All section-specific information must come from the appropriate section data and geometry files.

Do not introduce:

- Duplicate rendering engines.
- Duplicate component catalogs.
- Duplicate animation systems.
- Section-specific hardcoded engineering values.
- Unnecessary dependencies.
- Unnecessary asset replacements.
- Changes to parent-child communication.

Preserve compatibility with every previously generated section.

---

# PHASE 7: ENGINEERING ACCURACY AND GEOMETRY VALIDATION

The generated diagram must accurately represent the original engineering drawing.

Verify the following:

## 7.1 Pipe Geometry

- Correct pipe routes.
- Correct line identifiers.
- Correct pipe colors where available.
- Correct branches.
- Correct bends.
- Correct junctions.
- Correct crossings.
- Correct flow directions.
- Correct pipe dimensions where specified.

## 7.2 Component Geometry

- Correct component positions.
- Correct dimensions.
- Correct orientations.
- Correct inlet and outlet ports.
- Correct connection points.
- Correct component-to-pipe relationships.

## 7.3 Topology

Distinguish between:

- Actual connected junctions.
- Pipes crossing visually without connection.
- Branch connections.
- Component inlet connections.
- Component outlet connections.

Do not create a connection simply because two pipes visually intersect.

## 7.4 Cross-View Consistency

Verify that:

- 2D and 3D use the same component IDs.
- 2D and 3D use the same component records.
- 2D and 3D use consistent positions.
- 2D and 3D use consistent geometry.
- 2D and 3D use consistent connections.
- Selection and highlighting work across both views.

---

# PHASE 8: IMPLEMENTATION WORKFLOW AND TYPE VALIDATION

Follow an incremental implementation process.

Do not write all files at once.

For every file:

1. Inspect the existing implementation and dependencies.
2. Understand the expected interfaces and types.
3. Implement the required changes.
4. Check the errors reported after writing the file.
5. Resolve all errors introduced by that change.
6. Proceed to the next file only after the current changes are valid.

Before finishing, run:

`typecheck`

Inspect the project's existing scripts and configuration to determine the correct type-check command.

Resolve errors introduced by the new section.

Verify that previously generated sections still type-check.

Do not hide errors using:

- `any` unnecessarily.
- `@ts-ignore`.
- `@ts-nocheck`.
- Unsafe type assertions.
- Disabled TypeScript checks.

If an existing unrelated error prevents validation, identify and report it separately.

---

# PHASE 9: BUILD AND FINAL VALIDATION

Inspect the existing build configuration before executing commands.

Run:

`npm run build`

ONLY if all generated build outputs remain inside the permitted `child/` scope.

Never modify parent configuration or build settings to bypass this restriction.

If the build generates output outside `child/`, do not run it. Explain why.

## Required validation checklist

Verify all of the following:

1. New section is registered correctly.
2. New section loads through the existing application.
3. Overview interface displays correctly.
4. 2D diagram renders correctly.
5. 3D diagram renders correctly.
6. Every physical component is identified.
7. Every component has a unique instance ID.
8. Engineering tags match the original drawing.
9. Reference images match the correct components.
10. Engineering values belong to the correct component.
11. All values and units are preserved.
12. Pipe connections are correct.
13. Pipe branches and junctions are accurate.
14. Visual crossings are not incorrectly connected.
15. Component dimensions and orientations are accurate.
16. Component ports connect correctly.
17. Component selection works.
18. Cross-view highlighting works.
19. Animation follows the supplied configuration.
20. Alarms follow the supplied configuration.
21. Existing sections remain functional.
22. Shared components remain backward-compatible.
23. `data.json` remains unchanged.
24. Parent-child communication remains unchanged.
25. Type-check results are recorded.
26. Build results are recorded, if the build is permitted.

Do not report a feature as working unless it has actually been verified.

---

# PHASE 10: FINAL IMPLEMENTATION REPORT

After implementation and validation, provide a structured report.

## 1. Implementation Summary
- Section name and ID.
- Section registration status.
- Overall implementation status.

## 2. Files Created
List every newly created file with its purpose.

## 3. Files Modified
List every modified file with:
- File path.
- Reason for modification.
- Whether it is section-specific or shared.

## 4. Existing Components and Assets Reused
List:
- Reused 2D components.
- Reused 3D components.
- Reused Library objects.
- Reused reference images.
- Reused materials and rendering systems.

## 5. New Components and Assets
List only genuinely new components, assets and catalog entries.

Explain why existing components were insufficient.

## 6. Component Identification and Engineering Mapping

Provide a table:

| Engineering Tag | Instance ID | Component Type | Reference Image | Data Record | Mapping Status |
|---|---|---|---|---|---|

Use only verified information.

## 7. Engineering and Connectivity Validation
Report:
- Total components identified.
- Verified mappings.
- Partially verified mappings.
- Ambiguous mappings.
- Missing data.
- Unmatched components.
- Pipe connections verified.
- Unresolved connections.

## 8. Assumptions and Unresolved Issues
Clearly identify all missing or uncertain information.

Never present assumptions as verified engineering facts.

## 9. Validation Results

| Validation | Result |
|---|---|
| Section registration | |
| Overview rendering | |
| 2D rendering | |
| 3D rendering | |
| Component mapping | |
| Pipe connectivity | |
| Cross-view consistency | |
| Component interactions | |
| Animations and alarms | |
| Typecheck | |
| Build | |
| Existing sections compatibility | |
| data.json integrity | |

Use actual results: Passed, Failed, Blocked or Not Tested.

---

# STRICT FINAL INSTRUCTIONS

1. Work exclusively inside `child/`.
2. Add a section, not another engine.
3. Reuse existing components and assets before creating new ones.
4. Preserve all existing shared functionality.
5. Do not modify unrelated sections.
6. Do not replace existing assets unnecessarily.
7. Never modify or overwrite the supplied `data.json`.
8. Preserve existing `manual-data.json` and inspect it when available.
9. Never invent engineering information.
10. Never guess uncertain component mappings.
11. Ask me before implementing uncertain engineering identities, values or connections.
12. Keep 2D and 3D representations synchronized.
13. Make genuinely reusable shared changes backward-compatible.
14. Never modify the shared viewer (`@shipdocs/viewer-core`); import what it exports.
15. Fix introduced type errors before proceeding.
16. Run `typecheck` before finishing.
17. Run the build only when permitted by the existing build configuration.
18. Do not claim successful validation without actual verification.
19. Preserve parent-child communication and the existing project architecture.
20. Do not rebuild functionality that already exists in the common engine.

# FINAL GOAL

Add the newly supplied ship piping diagram as a fully functional, accurately mapped section within the existing generic industrial piping application.

The new section must integrate seamlessly with the existing Overview, 2D and 3D systems, reuse the common engine, preserve engineering accuracy, maintain correct component identities and pipe connectivity, and avoid disrupting any previously generated sections or shared functionality.

**Prioritize engineering correctness, existing architecture compatibility, component reuse and data integrity over implementation speed.**