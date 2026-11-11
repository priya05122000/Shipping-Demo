import {
  definePipeline,
  type Decoration,
  type Fluid,
  type PartFacts,
  type PartKind,
  type PartLayout,
  type PipeDef,
  type PipelineSystems,
  type Pt,
  type TextLabel,
} from "@shipdocs/viewer-core/pipeline";

/*
 * The bunker section's schematic: its geometry, traced from the line diagram in
 * this folder (see section.json), for Diagram2D.tsx and Diagram3D.tsx. Coordinates
 * are diagram units; the layout follows the drawing but is spaced out so the
 * objects' pictures fit. Below the drawing, FACTS says what the drawing shows about
 * each part (its name, fluid, line and area, how its tank or hose is set up) and
 * which engineering record it is: `component` is its tag in this section's
 * manual-data.json, where its specifications, troubleshooting and position come
 * from. OBJECTS names the Library objects (src/objects/) that draw the parts.
 *
 * Tag pattern: TYPE-SECTION# where SECTION is
 *   DT  D.O tanks (accommodation)     DH  D.O header (FB100)
 *   FT  F.O tanks                     FH  F.O header (FA101)
 *   M1/M2/M3 + P/S  manifold heads (M1 = D.O FB101, M2 = F.O FA102, M3 = F.O FA101;
 *                   P = port / top of drawing, S = starboard / bottom)
 * FA516 keeps the tag printed on the drawing.
 */

const TOP = 90; // manifold flanges, top heads
const BOT = 1060; // manifold flanges, bottom heads
const HDR_DO = 430; // D.O header (FB100-100A)
const HDR_FO = 580; // F.O header
const M1 = 1280; // D.O manifold
const M2 = 1520; // F.O manifold (FA102)
const M3 = 1840; // F.O manifold (FA101)

const pipes: PipeDef[] = [];
const parts: PartLayout[] = [];
const decorations: Decoration[] = [];
const labels: TextLabel[] = [];

const pipe = (p: PipeDef) => pipes.push(p);
const part = (p: PartLayout) => parts.push(p);

// ── D.O tanks, accommodation ────────────────────────────────────────────────
pipe({
  id: "do-header",
  fluid: "DO",
  line: "FB100-100A",
  size: "main",
  pts: [
    [128, 220],
    [560, 220],
    [560, HDR_DO],
    [M1, HDR_DO],
  ],
});
pipe({
  id: "do-vertical",
  fluid: "DO",
  line: "FB100-100A",
  size: "main",
  z: 2,
  pts: [
    [225, 220],
    [225, 891],
  ],
});
pipe({
  id: "do-stub",
  fluid: "DO",
  line: "FB100-100A",
  size: "branch",
  pts: [
    [560, 320],
    [494, 320],
  ],
});
pipe({
  id: "do-relief-1",
  fluid: "DO",
  line: "FB100-100A",
  size: "small",
  pts: [
    [100, 259],
    [100, 330],
    [165, 330],
  ],
});
pipe({
  id: "do-relief-1-out",
  fluid: "DO",
  line: "Relief discharge",
  size: "small",
  dashed: true,
  arrowEnd: true,
  pts: [
    [165, 330],
    [312, 330],
  ],
});
pipe({
  id: "do-relief-2",
  fluid: "DO",
  line: "FB100-100A",
  size: "small",
  pts: [
    [197, 930],
    [140, 930],
    [140, 760],
    [175, 760],
  ],
});
pipe({
  id: "do-relief-2-out",
  fluid: "DO",
  line: "Relief discharge",
  size: "small",
  dashed: true,
  arrowEnd: true,
  pts: [
    [175, 760],
    [312, 760],
  ],
});

part({
  tag: "TK-DO1",
  kind: "TK",
  at: [100, 220],
  tankColor: "blue",
  label: "top",
});
part({
  tag: "TK-DO2",
  kind: "TK",
  at: [225, 930],
  tankColor: "blue",
  label: "right",
});
part({
  tag: "BFV-DT01",
  kind: "BFV",
  at: [172, 220],
  label: "top",
});
part({
  tag: "BFV-DT02",
  kind: "BFV",
  at: [225, 830],
  rot: -90,
  label: "right",
});
part({
  tag: "PSV-DT01",
  kind: "PSV",
  at: [165, 330],
  label: "bottom",
});
part({
  tag: "PSV-DT02",
  kind: "PSV",
  at: [175, 760],
  label: "top",
});

// ── D.O header ──────────────────────────────────────────────────────────────
part({
  tag: "BFV-DH01",
  kind: "BFV",
  at: [522, 320],
  label: "top",
});
part({
  tag: "DJ-DH01",
  kind: "DJ",
  at: [730, HDR_DO],
  label: "top",
});
part({
  tag: "DJ-DH02",
  kind: "DJ",
  at: [1040, HDR_DO],
  label: "top",
});
part({
  tag: "DJ-DH03",
  kind: "DJ",
  at: [1170, HDR_DO],
  label: "top",
});
decorations.push({ type: "cap", at: [494, 320], orient: "v" });

// ── F.O tanks ───────────────────────────────────────────────────────────────
pipe({
  id: "fo-main",
  fluid: "FO",
  line: "FA101-150A",
  size: "main",
  z: 2,
  pts: [
    [668, 130],
    [920, 130],
    [920, 960],
    [668, 960],
  ],
});
pipe({
  id: "fo-branch-tk2",
  fluid: "FO",
  line: "FA101-150A",
  size: "branch",
  pts: [
    [780, 130],
    [780, 300],
    [728, 300],
  ],
});
pipe({
  id: "fo-branch-tk3",
  fluid: "FO",
  line: "FA101-150A",
  size: "branch",
  pts: [
    [780, 960],
    [780, 820],
    [728, 820],
  ],
});
pipe({
  id: "fo-transfer",
  fluid: "FO",
  line: "FA101-150A",
  size: "branch",
  pts: [
    [620, 500],
    [920, 500],
  ],
});
pipe({
  id: "fo-relief",
  fluid: "FO",
  line: "FA101-150A",
  size: "small",
  pts: [
    [750, 960],
    [750, 1030],
    [650, 1030],
    [650, 999],
  ],
});

part({
  tag: "TK-FO1",
  kind: "TK",
  at: [650, 130],
  tankColor: "red",
  label: "left",
});
part({
  tag: "TK-FO2",
  kind: "TK",
  at: [710, 300],
  tankColor: "red",
  label: "left",
});
part({
  tag: "TK-FO3",
  kind: "TK",
  at: [710, 820],
  tankColor: "red",
  label: "left",
});
part({
  tag: "TK-FO4",
  kind: "TK",
  at: [649, 960],
  tankColor: "red",
  label: "left",
});
part({
  tag: "BFV-FT01",
  kind: "BFV",
  at: [715, 130],
  label: "top",
});
part({
  tag: "BFV-FT02",
  kind: "BFV",
  at: [780, 190],
  rot: -90,
  label: "right",
});
part({
  tag: "BFV-FT03",
  kind: "BFV",
  at: [850, 500],
  label: "bottom",
});
part({
  tag: "BFV-FT04",
  kind: "BFV",
  at: [780, 895],
  rot: -90,
  label: "right",
});
part({
  tag: "BFV-FT05",
  kind: "BFV",
  at: [708, 960],
  label: "top",
});
part({
  tag: "PSV-FT01",
  kind: "PSV",
  at: [695, 1030],
  flip: true,
  label: "bottom",
});
part({
  tag: "DJ-FT01",
  kind: "DJ",
  at: [730, 500],
  label: "bottom",
});
decorations.push({ type: "ring", at: [620, 500] });

// ── F.O header ──────────────────────────────────────────────────────────────
// Split at M2 so the header joins that manifold (a pipe running straight through would be a crossing).
pipe({
  id: "fo-header",
  fluid: "FO",
  line: "FA101-150A",
  size: "main",
  pts: [
    [920, HDR_FO],
    [M2, HDR_FO],
  ],
});
pipe({
  id: "fo-header-m3",
  fluid: "FO",
  line: "FA101-150A",
  size: "main",
  pts: [
    [M2, HDR_FO],
    [M3, HDR_FO],
  ],
});
part({
  tag: "FA516",
  kind: "BFV",
  at: [975, HDR_FO],
  label: "bottom",
});
part({
  tag: "DJ-FH01",
  kind: "DJ",
  at: [1040, HDR_FO],
  label: "top",
});
part({
  tag: "DJ-FH02",
  kind: "DJ",
  at: [1170, HDR_FO],
  label: "top",
});
part({
  tag: "BFV-FH01",
  kind: "BFV",
  at: [1600, HDR_FO],
  label: "top",
});
part({
  tag: "DJ-FH03",
  kind: "DJ",
  at: [1720, HDR_FO],
  label: "top",
});

// ── Manifolds: one vertical line per manifold, with identical heads at both ends ──
function manifold(m: string, x: number, fluid: Fluid, line: string) {
  const fluidText = fluid === "DO" ? "D.O" : "F.O";
  pipe({
    id: `${m.toLowerCase()}-main`,
    fluid,
    line,
    size: "main",
    z: 2,
    pts: [
      [x, TOP],
      [x, BOT],
    ],
  });
  manifoldHead(m, "P", x, fluid, line, fluidText);
  manifoldHead(m, "S", x, fluid, line, fluidText);
}

function manifoldHead(
  m: string,
  side: "P" | "S",
  x: number,
  fluid: Fluid,
  line: string,
  fluidText: string,
) {
  const h = `${m}${side}`;
  const dir = side === "P" ? 1 : -1; // direction away from the flange
  const yF = side === "P" ? TOP : BOT;
  const y = (d: number) => yF + dir * d;
  const near: "top" | "bottom" = side === "P" ? "top" : "bottom";
  const drainX = x - 62;

  pipe({
    id: `${h}-drain-glv`,
    fluid,
    line,
    size: "small",
    pts: [
      [x, y(30)],
      [drainX, y(30)],
    ],
  });
  pipe({
    id: `${h}-drain-bv`,
    fluid,
    line,
    size: "small",
    pts: [
      [x, y(72)],
      [drainX, y(72)],
    ],
  });
  pipe({
    id: `${h}-drain`,
    fluid,
    line,
    size: "small",
    pts: [
      [drainX, y(72)],
      [drainX, y(-8)],
    ],
  });
  pipe({
    id: `${h}-gauge`,
    fluid,
    line,
    size: "small",
    pts: [
      [x, y(112)],
      [x + 68, y(112)],
    ],
  });
  pipe({
    id: `${h}-hose`,
    fluid,
    line,
    size: "small",
    pts: [
      [x, y(212)],
      [x + 20, y(212)],
    ],
  });

  part({
    tag: `MC-${h}`,
    kind: "MC",
    at: [x, yF],
    hoseDir: side === "P" ? -1 : 1,
    label: "right",
  });
  part({
    tag: `GLV-${h}`,
    kind: "GLV",
    at: [x - 31, y(30)],
    label: "left",
  });
  part({
    tag: `BV-${h}1`,
    kind: "BV",
    at: [x - 31, y(72)],
    label: "left",
  });
  part({
    tag: `BV-${h}2`,
    kind: "BV",
    at: [x + 34, y(112)],
    label: near,
  });
  part({
    tag: `PI-${h}`,
    kind: "PI",
    at: [x + 82, y(112)],
    label: "right",
  });
  part({
    tag: `MBV-${h}`,
    kind: "MBV",
    at: [x, y(162)],
    rot: -90,
    label: "right",
  });
  part({
    tag: `HV-${h}`,
    kind: "HV",
    at: [x + 20, y(212)],
    label: "right",
  });

  decorations.push({
    type: "drip",
    at: [drainX, y(-8)] as Pt,
    dir: side === "P" ? -1 : 1,
  });
  decorations.push({ type: "nub", at: [x, y(42)] });
  decorations.push({
    type: "fluidLabel",
    at: [x + 14, side === "P" ? yF - 26 : yF + 36],
    text: fluidText,
  });
}

manifold("M1", M1, "DO", "FB101-100A");
manifold("M2", M2, "FO", "FA102-150A");
manifold("M3", M3, "FO", "FA101-150A");

// ── Text ────────────────────────────────────────────────────────────────────
labels.push(
  { kind: "area", at: [395, 628], text: "ACCOMMODATION" },
  { kind: "area", at: [1705, 350], text: "CARGO MANIFOLD AREA", rot: -62 },
  { kind: "line", at: [211, 560], text: "FB100-100A", rot: -90 },
  { kind: "line", at: [860, HDR_DO - 14], text: "FB100-100A" },
  { kind: "line", at: [906, 300], text: "FA101-150A", rot: -90 },
  { kind: "line", at: [906, 760], text: "FA101-150A", rot: -90 },
  { kind: "line", at: [1400, HDR_FO - 14], text: "FA101-150A" },
  { kind: "line", at: [M1 - 14, 370], text: "FB101-100A", rot: -90 },
  { kind: "line", at: [M1 - 14, 760], text: "FB101-100A", rot: -90 },
  { kind: "line", at: [M2 - 14, 370], text: "FA102-150A", rot: -90 },
  { kind: "line", at: [M2 - 14, 760], text: "FA102-150A", rot: -90 },
  { kind: "line", at: [M3 - 14, 370], text: "FA101-150A", rot: -90 },
  { kind: "line", at: [M3 - 14, 760], text: "FA101-150A", rot: -90 },
);

// ── What the drawing shows about each part, by tag ─────────────────────────
// Engineering data is not here: `component` names the part's record in manual-data.json.
const FACTS: Record<string, PartFacts> = {
  "BFV-DT01": {
    name: "D.O Tank No.1 Valve",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    component: "FB112",
    pipes: { in: "do-header", out: "do-header" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BFV-DT02": {
    name: "D.O Tank No.2 Valve",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    component: "FB111",
    pipes: { in: "do-vertical", out: "do-vertical" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BFV-DH01": {
    name: "D.O Branch Valve",
    fluid: "DO",
    line: "FB100-100A",
    area: "D.O header",
    component: "65A",
    pipes: { in: "do-stub", out: "do-stub" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BFV-FT01": {
    name: "F.O Tank No.1 Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    component: "FA521",
    pipes: { in: "fo-main", out: "fo-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BFV-FT02": {
    name: "F.O Tank No.2 Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    component: "FA520",
    pipes: { in: "fo-branch-tk2", out: "fo-branch-tk2" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BFV-FT03": {
    name: "F.O Transfer Line Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    component: "FA575",
    pipes: { in: "fo-transfer", out: "fo-transfer" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BFV-FT04": {
    name: "F.O Tank No.3 Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    component: "FA518",
    pipes: { in: "fo-branch-tk3", out: "fo-branch-tk3" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BFV-FT05": {
    name: "F.O Tank No.4 Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    component: "FA519",
    pipes: { in: "fo-main", out: "fo-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  FA516: {
    name: "F.O Header Isolation Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O header",
    component: "FA516",
    pipes: { in: "fo-header", out: "fo-header" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BFV-FH01": {
    name: "F.O Manifold Crossover Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O header",
    component: "FA515",
    pipes: { in: "fo-header-m3", out: "fo-header-m3" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "GLV-M1P": {
    name: "Drain Globe Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    component: "FB544",
    pipes: { in: "M1P-drain-glv", out: "M1P-drain-glv" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BV-M1P1": {
    name: "Drain Ball Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    component: "FB582",
    pipes: { in: "M1P-drain-bv", out: "M1P-drain-bv" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BV-M1P2": {
    name: "Gauge Isolation Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    component: "FB572",
    pipes: { in: "M1P-gauge", out: "M1P-gauge" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "MBV-M1P": {
    name: "Manifold Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    component: "FB512",
    pipes: { in: "m1-main", out: "m1-main" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "HV-M1P": {
    name: "Hose / Landing Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    component: "FB542",
    pipes: { in: "M1P-hose", out: null },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "GLV-M1S": {
    name: "Drain Globe Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    component: "FB543",
    pipes: { in: "M1S-drain-glv", out: "M1S-drain-glv" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BV-M1S1": {
    name: "Drain Ball Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    component: "FB581",
    pipes: { in: "M1S-drain-bv", out: "M1S-drain-bv" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "BV-M1S2": {
    name: "Gauge Isolation Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    component: "FB571",
    pipes: { in: "M1S-gauge", out: "M1S-gauge" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "MBV-M1S": {
    name: "Manifold Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    component: "FB511",
    pipes: { in: "m1-main", out: "m1-main" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "HV-M1S": {
    name: "Hose / Landing Valve",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    component: "FB541",
    pipes: { in: "M1S-hose", out: null },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "GLV-M2P": {
    name: "Drain Globe Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    component: "FA546",
    pipes: { in: "M2P-drain-glv", out: "M2P-drain-glv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M2P1": {
    name: "Drain Ball Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    component: "FA582",
    pipes: { in: "M2P-drain-bv", out: "M2P-drain-bv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M2P2": {
    name: "Gauge Isolation Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    component: "FA572",
    pipes: { in: "M2P-gauge", out: "M2P-gauge" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "MBV-M2P": {
    name: "Manifold Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    component: "FA512",
    pipes: { in: "m2-main", out: "m2-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "HV-M2P": {
    name: "Hose / Landing Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    component: "FA542",
    pipes: { in: "M2P-hose", out: null },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "GLV-M2S": {
    name: "Drain Globe Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    component: "FA545",
    pipes: { in: "M2S-drain-glv", out: "M2S-drain-glv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M2S1": {
    name: "Drain Ball Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    component: "FA581",
    pipes: { in: "M2S-drain-bv", out: "M2S-drain-bv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M2S2": {
    name: "Gauge Isolation Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    component: "FA571",
    pipes: { in: "M2S-gauge", out: "M2S-gauge" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "MBV-M2S": {
    name: "Manifold Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    component: "FA511",
    pipes: { in: "m2-main", out: "m2-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "HV-M2S": {
    name: "Hose / Landing Valve",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    component: "FA541",
    pipes: { in: "M2S-hose", out: null },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "GLV-M3P": {
    name: "Drain Globe Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    component: "FA548",
    pipes: { in: "M3P-drain-glv", out: "M3P-drain-glv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M3P1": {
    name: "Drain Ball Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    component: "FA584",
    pipes: { in: "M3P-drain-bv", out: "M3P-drain-bv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M3P2": {
    name: "Gauge Isolation Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    component: "FA574",
    pipes: { in: "M3P-gauge", out: "M3P-gauge" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "MBV-M3P": {
    name: "Manifold Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    component: "FA514",
    pipes: { in: "m3-main", out: "m3-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "HV-M3P": {
    name: "Hose / Landing Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    component: "FA544",
    pipes: { in: "M3P-hose", out: null },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "GLV-M3S": {
    name: "Drain Globe Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    component: "FA547",
    pipes: { in: "M3S-drain-glv", out: "M3S-drain-glv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M3S1": {
    name: "Drain Ball Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    component: "FA583",
    pipes: { in: "M3S-drain-bv", out: "M3S-drain-bv" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "BV-M3S2": {
    name: "Gauge Isolation Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    component: "FA573",
    pipes: { in: "M3S-gauge", out: "M3S-gauge" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "MBV-M3S": {
    name: "Manifold Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    component: "FA513",
    pipes: { in: "m3-main", out: "m3-main" },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "HV-M3S": {
    name: "Hose / Landing Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    component: "FA543",
    pipes: { in: "M3S-hose", out: null },
    related: ["PUMP_FO_001", "TANK_FO_001"],
  },
  "PSV-DT01": {
    name: "D.O Tank No.1 Relief Valve",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    relief: { setPressureBar: 10, protects: "TK-DO1" },
    component: "FB105",
    pipes: { in: "do-relief-1", out: "do-relief-1-out" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "PSV-DT02": {
    name: "D.O Tank No.2 Relief Valve",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    relief: { setPressureBar: 10, protects: "TK-DO2" },
    component: "FB104",
    pipes: { in: "do-relief-2", out: "do-relief-2-out" },
    related: ["PUMP_DO_001", "TANK_DO_001"],
  },
  "PSV-FT01": {
    name: "F.O Tank No.4 Relief Valve",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    relief: { setPressureBar: 10, protects: "TK-FO4" },
  },
  "TK-DO1": {
    name: "D.O Storage Tank No.1",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    tank: { capacityM3: 120, levelPct: 34, tempC: 24.1, highPct: 90, highHighPct: 95, inletValve: "BFV-DT01" },
  },
  "TK-DO2": {
    name: "D.O Storage Tank No.2",
    fluid: "DO",
    line: "FB100-100A",
    area: "Accommodation",
    tank: { capacityM3: 120, levelPct: 71.2, tempC: 23.6, highPct: 90, highHighPct: 95, inletValve: "BFV-DT02" },
  },
  "TK-FO1": {
    name: "F.O Tank No.1",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    tank: { capacityM3: 450, levelPct: 41.5, tempC: 41, highPct: 90, highHighPct: 95, inletValve: "BFV-FT01" },
  },
  "TK-FO2": {
    name: "F.O Tank No.2",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    tank: { capacityM3: 450, levelPct: 28.3, tempC: 39.4, highPct: 90, highHighPct: 95, inletValve: "BFV-FT02" },
  },
  "TK-FO3": {
    name: "F.O Tank No.3",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    tank: { capacityM3: 380, levelPct: 88.1, tempC: 44.2, highPct: 90, highHighPct: 95, inletValve: "BFV-FT04" },
  },
  "TK-FO4": {
    name: "F.O Tank No.4",
    fluid: "FO",
    line: "FA101-150A",
    area: "F.O tank area",
    tank: { capacityM3: 380, levelPct: 52.6, tempC: 40.3, highPct: 90, highHighPct: 95, inletValve: "BFV-FT05" },
  },
  "MC-M1P": {
    name: "D.O Manifold Connection M1P",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    hose: { connected: true, pressureBar: 3.6, tempC: 27.4 },
  },
  "MC-M1S": {
    name: "D.O Manifold Connection M1S",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    hose: { connected: false },
  },
  "MC-M2P": {
    name: "F.O Manifold Connection M2P",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    hose: { connected: true, pressureBar: 5.2, tempC: 47.8 },
  },
  "MC-M2S": {
    name: "F.O Manifold Connection M2S",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    hose: { connected: false },
  },
  "MC-M3P": {
    name: "F.O Manifold Connection M3P",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    hose: { connected: false },
  },
  "MC-M3S": {
    name: "F.O Manifold Connection M3S",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    hose: { connected: false },
  },
  "PI-M1P": {
    name: "Manifold Pressure Gauge",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · port",
    gauge: { hose: "MC-M1P", isolationValve: "BV-M1P2", maxBar: 16, highBar: 7 },
  },
  "PI-M1S": {
    name: "Manifold Pressure Gauge",
    fluid: "DO",
    line: "FB101-100A",
    area: "Manifold M1 · starboard",
    gauge: { hose: "MC-M1S", isolationValve: "BV-M1S2", maxBar: 16, highBar: 7 },
  },
  "PI-M2P": {
    name: "Manifold Pressure Gauge",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · port",
    gauge: { hose: "MC-M2P", isolationValve: "BV-M2P2", maxBar: 16, highBar: 7 },
  },
  "PI-M2S": {
    name: "Manifold Pressure Gauge",
    fluid: "FO",
    line: "FA102-150A",
    area: "Manifold M2 · starboard",
    gauge: { hose: "MC-M2S", isolationValve: "BV-M2S2", maxBar: 16, highBar: 7 },
  },
  "PI-M3P": {
    name: "Manifold Pressure Gauge",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · port",
    gauge: { hose: "MC-M3P", isolationValve: "BV-M3P2", maxBar: 16, highBar: 7 },
  },
  "PI-M3S": {
    name: "Manifold Pressure Gauge",
    fluid: "FO",
    line: "FA101-150A",
    area: "Manifold M3 · starboard",
    gauge: { hose: "MC-M3S", isolationValve: "BV-M3S2", maxBar: 16, highBar: 7 },
  },
  "DJ-DH01": { name: "D.O Header Dismantling Joint 1", fluid: "DO", line: "FB100-100A", area: "D.O header" },
  "DJ-DH02": { name: "D.O Header Dismantling Joint 2", fluid: "DO", line: "FB100-100A", area: "D.O header" },
  "DJ-DH03": { name: "D.O Header Dismantling Joint 3", fluid: "DO", line: "FB100-100A", area: "D.O header" },
  "DJ-FT01": { name: "F.O Transfer Line Dismantling Joint", fluid: "FO", line: "FA101-150A", area: "F.O tank area" },
  "DJ-FH01": { name: "F.O Header Dismantling Joint 1", fluid: "FO", line: "FA101-150A", area: "F.O header" },
  "DJ-FH02": { name: "F.O Header Dismantling Joint 2", fluid: "FO", line: "FA101-150A", area: "F.O header" },
  "DJ-FH03": { name: "F.O Header Dismantling Joint 3", fluid: "FO", line: "FA101-150A", area: "F.O header" },
};

/** The systems the parts belong to: tanks made of several tanks on the drawing, and the pumps that supply them. */
const SYSTEMS: PipelineSystems = {
  tanks: {
    TANK_DO_001: {
      name: "D.O tanks",
      fluid: "DO",
      system: "Diesel Oil (D.O.) Filling & Transfer System",
      tags: ["TK-DO1", "TK-DO2"],
    },
    TANK_FO_001: {
      name: "F.O tanks",
      fluid: "FO",
      system: "Fuel Oil (F.O.) Filling & Transfer System",
      tags: ["TK-FO1", "TK-FO2", "TK-FO3", "TK-FO4"],
    },
  },
  pumps: {
    PUMP_DO_001: { name: "D.O pump", fluid: "DO", system: "Diesel Oil (D.O.) Filling & Transfer System", onDiagram: false },
    PUMP_FO_001: { name: "F.O pump", fluid: "FO", system: "Fuel Oil (F.O.) Filling & Transfer System", onDiagram: false },
  },
};

/** The Library objects (src/objects/<id>, picked for this section in section.json) that draw each kind of part. */
const OBJECTS: Partial<Record<PartKind, string>> = {
  BFV: "OBJ-001",
  PSV: "OBJ-002",
  GLV: "OBJ-003",
  BV: "OBJ-004",
  HV: "OBJ-005",
  MBV: "OBJ-006",
  DJ: "OBJ-007",
  TK: "OBJ-008",
};
/** The F.O tanks are red glass. */
const RED_TANK = "OBJ-009";

export default definePipeline({
  id: "bunker",
  title: "F.O & D.O Bunkering System",
  subtitle: "Accommodation · tank area · cargo manifold area",
  width: 2040,
  height: 1130,
  pipes,
  parts: parts.map((p) => ({ ...p, ...FACTS[p.tag], ...(p.tankColor === "red" && { object: RED_TANK }) })),
  decorations,
  labels,
  objects: OBJECTS,
  systems: SYSTEMS,
  flowTitle: "Bunkering flow",
});
