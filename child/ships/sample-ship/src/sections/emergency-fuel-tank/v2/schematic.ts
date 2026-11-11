import {
  definePipeline,
  type Decoration,
  type PartFacts,
  type PartKind,
  type PartLayout,
  type PipeDef,
  type PipelineSystems,
  type TextLabel,
} from "@shipdocs/viewer-core/pipeline";

/*
 * The emergency fuel tank section's schematic: its geometry, traced from the line diagram in this folder
 * (lineDiagram-a3b41de8.png, see section.json), for Diagram2D.tsx and Diagram3D.tsx. Coordinates are the drawing's
 * pixels shifted by (-380, -300), so the layout is the drawing's. FACTS says what the drawing shows about each part and
 * which engineering record it is: `component` is its id in this section's manual-data.json (the drawing prints
 * "V-001", the manual's records are "V001"; only the hyphen differs). OBJECTS names the Library objects (src/objects/)
 * that draw the parts.
 *
 * Read from the drawing:
 *   - One vertical F.O line, from the flanged "F.O" connection at the top down past the bottom of the sheet (where it
 *     goes is not shown, so it ends in a ring end there). No flow arrows are drawn; the F.O connection is taken as the supply because it is the
 *     line's flanged end in a "Filling & Transfer" system (manual-data.json), which is what the engine's flow needs.
 *   - T-001's leg runs down the left, takes V-001's branch from the main line, and turns right through V-002 to T-002.
 *   - V-002's line meets the main line at a plain four-way intersection with no dot or hop. Drawn here as a CROSSING
 *     (not connected), the drawing's lines both running straight on; whether it is a junction is unresolved.
 *   - V-003 isolates the circled "P", taken as a pressure gauge (it is only connected on one side).
 *   - V-004 sits on the main line, its handle on the left.
 *   - V-005 is drawn as a valve with a hose coupling (the rectangle) on its outlet, at the open end of its branch: a
 *     hydrant / landing valve, drawn with the section's Hydrant Landing Valve object (OBJ-005). Its manual-data.json
 *     record (V005) calls it a "GATE VALVE", which is kept as its record; the drawing does not say what is connected
 *     to its coupling, so its outlet is an open end.
 * Not on the drawing, so not here: line numbers, pipe sizes, the gauge's range, the tanks' high-high alarms, the hose's
 * state, and where the bottom of the main line goes.
 */

const LINE = "—"; // no line numbers are printed on the drawing

const MAIN_X = 333; // the F.O main line
const LEG_X = 128; // T-001's leg
const FO_Y = 112; // F.O connection (top of the main line)
const BOTTOM_Y = 1212; // where the main line leaves the sheet
const V001_Y = 255; // V-001 branch
const V002_Y = 500; // V-002 / T-002 line
const V003_Y = 668; // V-003 / gauge branch
const V004_Y = 840; // V-004 on the main line
const V005_Y = 1033; // V-005 branch
const V005_X = 452; // V-005's inlet flange, so its body sits where the drawing's does

const pipes: PipeDef[] = [];
const parts: PartLayout[] = [];
const decorations: Decoration[] = [];
const labels: TextLabel[] = [];

const pipe = (p: PipeDef) => pipes.push(p);
const part = (p: PartLayout) => parts.push(p);

// ── Main line ───────────────────────────────────────────────────────────────
pipe({
  id: "fo-main",
  fluid: "FO",
  line: LINE,
  size: "main",
  z: 2, // passes over V-002's line, which the drawing does not mark as joined to it
  pts: [
    [MAIN_X, FO_Y],
    [MAIN_X, BOTTOM_Y],
  ],
});
part({ tag: "F.O", kind: "MC", at: [MAIN_X, FO_Y], hoseDir: -1, label: "top" });
part({ tag: "V-004", kind: "BFV", at: [MAIN_X, V004_Y], rot: -90, label: "right" });
// Where the main line leaves the sheet: a ring end, not a plain one. The drawing doesn't say what it joins there.
decorations.push({ type: "ring", at: [MAIN_X, BOTTOM_Y] });

// ── T-001, V-001 and V-002, T-002 ───────────────────────────────────────────
pipe({
  id: "t001-leg",
  fluid: "FO",
  line: LINE,
  size: "branch",
  pts: [
    [LEG_X, 170],
    [LEG_X, V002_Y],
    [482, V002_Y],
  ],
});
pipe({
  id: "v001-branch",
  fluid: "FO",
  line: LINE,
  size: "branch",
  pts: [
    [MAIN_X, V001_Y],
    [LEG_X, V001_Y],
  ],
});
part({ tag: "T-001", kind: "TK", at: [LEG_X, 132], tankColor: "red", label: "top" });
part({ tag: "T-002", kind: "TK", at: [500, V002_Y], tankColor: "red", label: "top" });
part({ tag: "V-001", kind: "GLV", at: [233, V001_Y], label: "top" });
part({ tag: "V-002", kind: "BV", at: [232, V002_Y], label: "top" });

// ── V-003 and the gauge ─────────────────────────────────────────────────────
pipe({
  id: "gauge-branch",
  fluid: "FO",
  line: LINE,
  size: "branch",
  pts: [
    [MAIN_X, V003_Y],
    [541, V003_Y],
  ],
});
part({ tag: "V-003", kind: "BV", at: [442, V003_Y], label: "top" });
part({ tag: "P", kind: "PI", at: [555, V003_Y], label: "right" });

// ── V-005 branch, ending in the landing valve's hose coupling ───────────────
pipe({
  id: "v005-branch",
  fluid: "FO",
  line: LINE,
  size: "branch",
  pts: [
    [MAIN_X, V005_Y],
    [V005_X, V005_Y],
  ],
});
part({ tag: "V-005", kind: "HV", at: [V005_X, V005_Y], label: "top" });

// ── What the drawing and manual show about each part, by tag ───────────────
const SYSTEM = "Fuel Oil (F.O.) Filling & Transfer System";
const AREA = "Fuel transfer piping";

const FACTS: Record<string, PartFacts> = {
  "F.O": {
    name: "F.O connection",
    fluid: "FO",
    line: LINE,
    area: AREA,
    // hose: not on the drawing, so the engine's default (not connected) until it is connected in operations.
  },
  "V-001": {
    name: "T-001 Branch Stop Valve",
    fluid: "FO",
    line: LINE,
    area: AREA,
    component: "V001",
    pipes: { in: "v001-branch", out: "v001-branch" },
  },
  "V-002": {
    name: "T-001 / T-002 Line Ball Valve",
    fluid: "FO",
    line: LINE,
    area: AREA,
    component: "V002",
    pipes: { in: "t001-leg", out: "t001-leg" },
  },
  "V-003": {
    name: "Gauge Isolation Valve",
    fluid: "FO",
    line: LINE,
    area: AREA,
    component: "V003",
    pipes: { in: "gauge-branch", out: "gauge-branch" },
  },
  "V-004": {
    name: "Main Line Butterfly Valve",
    fluid: "FO",
    line: LINE,
    area: AREA,
    component: "V004",
    pipes: { in: "fo-main", out: "fo-main" },
  },
  "V-005": {
    name: "Hydrant / Landing Valve",
    fluid: "FO",
    line: LINE,
    area: AREA,
    component: "V005",
    pipes: { in: "v005-branch", out: null }, // its hose coupling is an open end; nothing is drawn on it
  },
  P: {
    name: "Pressure Gauge",
    fluid: "FO",
    line: LINE,
    area: AREA,
    // Its range and warning pressure aren't given: these are the engine's own defaults for a gauge without them.
    gauge: { hose: "F.O", isolationValve: "V-003", maxBar: 16, highBar: 16 },
  },
  // Tanks, from their manual-data.json records (capacity 5000 / 3000 litres, level 0 %, 25 °C, high level 90 %). No
  // high-high level is given, so it is 100 %, the engine's default. Inlet valves: the only valve between each tank and
  // the F.O connection on this schematic (they depend on V-002's line not joining the main line).
  "T-001": {
    name: "Fuel Oil Storage Tank",
    fluid: "FO",
    line: LINE,
    area: "Fuel oil storage area",
    tank: { capacityM3: 5, levelPct: 0, tempC: 25, highPct: 90, highHighPct: 100, inletValve: "V-001" },
  },
  "T-002": {
    name: "Fuel Oil Service Tank",
    fluid: "FO",
    line: LINE,
    area: "Fuel oil service area",
    tank: { capacityM3: 3, levelPct: 0, tempC: 25, highPct: 90, highHighPct: 100, inletValve: "V-002" },
  },
};

/** The system's tanks (manual-data.json gives both the same system). No pump is on the drawing or in the manual. */
const SYSTEMS: PipelineSystems = {
  tanks: {
    FO_TANKS: { name: "F.O tanks", fluid: "FO", system: SYSTEM, tags: ["T-001", "T-002"] },
  },
};

/** The Library objects (src/objects/<id>, picked for this section in section.json) that draw each kind of part. */
const OBJECTS: Partial<Record<PartKind, string>> = {
  BFV: "OBJ-001",
  GLV: "OBJ-003",
  BV: "OBJ-004",
  HV: "OBJ-005",
  TK: "OBJ-009",
};

export default definePipeline({
  id: "emergency-fuel-tank",
  title: "Emergency Fuel Tank",
  subtitle: SYSTEM,
  width: 700,
  height: 1260,
  pipes,
  parts: parts.map((p) => ({ ...p, ...FACTS[p.tag] })),
  decorations,
  labels,
  objects: OBJECTS,
  systems: SYSTEMS,
  flowTitle: "F.O flow",
});
