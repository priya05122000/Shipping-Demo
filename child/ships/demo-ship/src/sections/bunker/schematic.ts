import type { Equipment, Junction, MappingStatus, Pipe, PipeEnd, Point, Schematic, TextLabel } from "@/shared/schematic/types";

/*
 * Bunker (SEC-001): geometry traced from the section's line diagram (lineDiagram-a413b9fc.png), in its pixels.
 * The single geometry source for both Diagram2D and Diagram3D.
 *
 * Engineering values are not kept here. The section has no data.json yet, so `record` is null throughout;
 * `manualRecord` names the entry of the manual extract the tag matches, for reference only.
 *
 * Library objects are placed only where the evidence agrees (see the mapping report). Valves whose object is
 * unconfirmed are drawn with the shared symbols, listing their `candidates`.
 */

const DO = "do";
const FO = "fo";
const BUTTERFLY = ["OBJ-006", "OBJ-007"];
const GLOBE = ["OBJ-008"];

const equipment: Equipment[] = [];
const junctions: Junction[] = [];
const pipes: Pipe[] = [];

function add(item: Equipment): string {
  equipment.push(item);
  return item.id;
}

function junction(id: string, at: Point, dot = false): string {
  junctions.push({ id, at, dot });
  return id;
}

function end(item: string, port?: string): PipeEnd {
  return port ? { item, port } : { item };
}

let pipeCount = 0;
function pipe(fluid: string, line: string | undefined, bore: number | undefined, from: PipeEnd, to: PipeEnd, extra: Partial<Pipe> = {}): void {
  pipeCount += 1;
  pipes.push({ id: `PIPE-${String(pipeCount).padStart(3, "0")}`, fluid, line, bore, from, to, status: "verified", ...extra });
}

/** A valve with a tag from the drawing whose manual entry matches the tag. */
function taggedValve(
  tag: string,
  fluid: string,
  at: Point,
  rotation: Equipment["rotation"],
  size: number,
  options: Partial<Equipment> & { type: string },
): string {
  const { type, ...rest } = options;
  const status: MappingStatus = rest.object ? "partially-verified" : rest.candidates?.length ? "ambiguous" : "partially-verified";
  return add({
    id: `EQ-${tag}`,
    tag,
    kind: "valve",
    name: `${tag} ${type}`,
    at,
    rotation,
    size,
    fluid,
    record: null,
    manualRecord: tag,
    status,
    ...rest,
  });
}

const BALL_NOTE = "Ball valve per the manual extract; drawn with the Library's ball valve (OBJ-005).";
const BUTTERFLY_NOTE = "Butterfly valve per the manual extract. Library object unconfirmed: OBJ-006 or OBJ-007.";
const GLOBE_NOTE = "Stop (globe) valve per the manual extract. Library object unconfirmed: OBJ-008 is a candidate.";
const GATE_NOTE = "Gate valve with a blind flange per the manual extract. No gate valve in the Library.";

// ---------------------------------------------------------------------------------------------------------------
// D.O. (blue), accommodation side
// ---------------------------------------------------------------------------------------------------------------

const tankDo1 = add({
  id: "EQ-TK-DO-1",
  tag: null,
  kind: "tank",
  name: "D.O. tank (upper, untagged)",
  at: [97, 224],
  rotation: 0,
  size: 36,
  fluid: DO,
  record: null,
  status: "ambiguous",
  note: "No tag on the drawing. The manual extract relates two storage tanks (M.D.O S TOR.TK(P), M.O.D S TOR TK(S)) to FB112/FB001; which one this is is unconfirmed.",
});
const tankDo2 = add({
  id: "EQ-TK-DO-2",
  tag: null,
  kind: "tank",
  name: "D.O. tank (lower, untagged)",
  at: [166, 810],
  rotation: 0,
  size: 36,
  fluid: DO,
  record: null,
  manualRecord: "D.O S TOR.TK(S)",
  status: "partially-verified",
  note: "No tag on the drawing. Matched to D.O S TOR.TK(S) only through its related valves FB111/FB002 in the manual extract.",
});
const fb112 = taggedValve("FB112", DO, [136, 224], 0, 24, { type: "butterfly valve", variant: "handwheel", candidates: BUTTERFLY, note: BUTTERFLY_NOTE });
const fb111 = taggedValve("FB111", DO, [166, 765], 90, 24, {
  type: "butterfly valve",
  variant: "handwheel",
  candidates: BUTTERFLY,
  note: BUTTERFLY_NOTE,
  label: { at: [148, 765], rotate: -90 },
});
const fb001 = taggedValve("FB001", DO, [136, 326], 0, 26, {
  type: "safety / relief valve",
  kind: "relief-valve",
  object: "OBJ-004",
  manualRecord: "FA001",
  note: "Spring-loaded relief symbol as OBJ-004. The manual extract's entry is tagged FA001 (line FB105), not FB001: confirm.",
});
const fb002 = taggedValve("FB002", DO, [136, 714], 0, 26, {
  type: "safety / relief valve",
  kind: "relief-valve",
  object: "OBJ-004",
  manualRecord: "FA002",
  label: { at: [130, 688] },
  note: "Spring-loaded relief symbol as OBJ-004. The manual extract's entry is tagged FA002 (fault code FB104_F001), not FB002: confirm.",
});
const fb513 = add({
  id: "EQ-FB513",
  tag: "FB513",
  kind: "valve",
  variant: "handwheel",
  name: "FB513 valve (65A branch)",
  at: [700, 319],
  rotation: 0,
  size: 24,
  fluid: DO,
  record: null,
  status: "missing-data",
  note: "No entry in the manual extract; valve type and Library object unknown. Its left end is open on the drawing.",
});

const spool = (id: string, fluid: string, at: Point) =>
  add({
    id,
    tag: null,
    kind: "spool",
    name: "Flanged pipe spool (untagged)",
    at,
    rotation: 0,
    size: 22,
    fluid,
    object: "OBJ-009",
    record: null,
    status: "partially-verified",
    note: "Untagged; matched to the Library's flanged steel pipe (OBJ-009) by its symbol only.",
  });

const spDo1 = spool("EQ-SP-DO-1", DO, [858, 402]);
const spDo2 = spool("EQ-SP-DO-2", DO, [1062, 402]);
const spDo3 = spool("EQ-SP-DO-3", DO, [1224, 402]);

const jDo1 = junction("J-DO-1", [166, 224]);
const jDo2 = junction("J-DO-2", [755, 320]);
const jDoManifold = junction("J-DO-MAN", [1298, 402], true);

pipe(DO, "FB100-100A", 100, end(tankDo1, "e"), end(fb112, "in"));
pipe(DO, "FB100-100A", 100, end(fb112, "out"), end(jDo1));
pipe(DO, "FB100-100A", 100, end(jDo1), end(jDo2), { via: [[755, 224]] });
pipe(DO, "65A", 65, end(fb513, "out"), end(jDo2), {
  note: "Drawn ending on the vertical FB100 line, read as a tee.",
});
pipe(DO, "FB100-100A", 100, end(jDo2), end(spDo1, "in"), { via: [[755, 402]] });
pipe(DO, "FB100-100A", 100, end(spDo1, "out"), end(spDo2, "in"), {
  crossings: [{ at: [978, 402], style: "gap" }],
  note: "Crosses the F.O. FA101 line without joining it (the drawing breaks this line).",
});
pipe(DO, "FB100-100A", 100, end(spDo2, "out"), end(spDo3, "in"));
pipe(DO, "FB100-100A", 100, end(spDo3, "out"), end(jDoManifold));
pipe(DO, "FB100-100A", 100, end(jDo1), end(fb111, "in"));
pipe(DO, "FB100-100A", 100, end(fb111, "out"), end(tankDo2, "n"));
pipe(DO, "FB105-65A", 65, end(tankDo1, "s"), end(fb001, "in"), { via: [[97, 326]] });
pipe(DO, "FB105-65A", 65, end(fb001, "out"), { open: [205, 326] }, {
  crossings: [{ at: [166, 326], style: "arc" }],
  status: "unresolved",
  note: "Hops over the FB100 line and leaves the drawing; its destination isn't shown.",
});
pipe(DO, "FB104-65A", 65, end(tankDo2, "w"), end(fb002, "in"), { via: [[97, 810], [97, 714]] });
pipe(DO, "FB104-65A", 65, end(fb002, "out"), { open: [205, 714] }, {
  crossings: [{ at: [166, 714], style: "arc" }],
  status: "unresolved",
  note: "Hops over the FB100 line and leaves the drawing; its destination isn't shown.",
});

// ---------------------------------------------------------------------------------------------------------------
// F.O. (red), tank connections and the FA101 main
// ---------------------------------------------------------------------------------------------------------------

const foTank = (id: string, at: Point, name: string) =>
  add({
    id,
    tag: null,
    kind: "tank",
    name,
    at,
    rotation: 0,
    size: 36,
    fluid: FO,
    record: null,
    status: "missing-data",
    note: "No tag on the drawing and no F.O. tank in the manual extract.",
  });

const tankFo1 = foTank("EQ-TK-FO-1", [743, 181], "F.O. tank (FA108 line, untagged)");
const tankFo2 = foTank("EQ-TK-FO-2", [782, 329], "F.O. tank (FA520 branch, untagged)");
const tankFo3 = foTank("EQ-TK-FO-3", [782, 709], "F.O. tank (FA519 branch, untagged)");
const tankFo4 = foTank("EQ-TK-FO-4", [748, 858], "F.O. tank (FA103 line, untagged)");

const fa518 = taggedValve("FA518", FO, [780, 181], 0, 24, { type: "butterfly valve", variant: "handwheel", candidates: BUTTERFLY, note: BUTTERFLY_NOTE });
const fa520 = taggedValve("FA520", FO, [840, 208], 90, 24, {
  type: "butterfly valve",
  variant: "handwheel",
  candidates: BUTTERFLY,
  note: BUTTERFLY_NOTE,
  label: { at: [858, 208], rotate: -90 },
});
const fa521 = taggedValve("FA521", FO, [952, 453], 0, 24, {
  type: "butterfly valve",
  variant: "handwheel",
  candidates: BUTTERFLY,
  note: BUTTERFLY_NOTE,
  label: { at: [955, 437] },
});
const fa516 = taggedValve("FA516", FO, [1024, 541], 0, 24, { type: "butterfly valve", variant: "handwheel", candidates: BUTTERFLY, note: BUTTERFLY_NOTE });
const fa515 = taggedValve("FA515", FO, [1445, 541], 0, 24, { type: "butterfly valve", variant: "handwheel", candidates: BUTTERFLY, note: BUTTERFLY_NOTE });
const fa517 = taggedValve("FA517", FO, [780, 858], 0, 24, {
  type: "butterfly valve",
  variant: "handwheel",
  candidates: BUTTERFLY,
  label: { at: [787, 840] },
  note: `${BUTTERFLY_NOTE} The manual extract's FA517 entry lists pipes PIPE_FA575_*: confirm.`,
});
const fa519 = taggedValve("FA519", FO, [840, 830], 90, 24, {
  type: "butterfly valve",
  variant: "handwheel",
  candidates: BUTTERFLY,
  note: BUTTERFLY_NOTE,
  label: { at: [858, 830], rotate: -90 },
});
const fa575 = add({
  id: "EQ-FA575",
  tag: "FA575",
  kind: "angle-valve",
  name: "FA575 self-closing valve",
  at: [828, 898],
  rotation: 0,
  size: 24,
  fluid: FO,
  record: null,
  manualRecord: "FA575",
  candidates: ["OBJ-003"],
  status: "ambiguous",
  label: { at: [862, 902] },
  note: "Angle valve with a spring, like OBJ-003 (safety relief valve), but the manual extract calls it a self-closing valve, with pipes PIPE_65A_*: confirm.",
});
const openFo521 = add({
  id: "EQ-OE-FO-1",
  tag: null,
  kind: "open-end",
  variant: "circle",
  name: "Pipe end (FA521 line, untagged)",
  at: [762, 453],
  rotation: 270,
  size: 10,
  fluid: FO,
  record: null,
  status: "missing-data",
  note: "Drawn as a small circle: an open end or connection whose destination isn't shown.",
});

const spFo1 = spool("EQ-SP-FO-1", FO, [858, 453]);
const spFo2 = spool("EQ-SP-FO-2", FO, [1062, 541]);
const spFo3 = spool("EQ-SP-FO-3", FO, [1224, 541]);
const spFo4 = spool("EQ-SP-FO-4", FO, [1566, 541]);

const jFoTop = junction("J-FO-TOP", [978, 181]);
const jFo520 = junction("J-FO-520", [840, 181]);
const jFo521 = junction("J-FO-521", [978, 453]);
const jFo516 = junction("J-FO-516", [978, 541]);
const jFoBottom = junction("J-FO-BOT", [978, 858]);
const jFo519 = junction("J-FO-519", [840, 858]);
const jFo575 = junction("J-FO-575", [828, 858]);
const jFoManifold1 = junction("J-FOM1-541", [1413, 541], true);
const jFoManifold2 = junction("J-FOM2-541", [1820, 541], true);

pipe(FO, "FA108-150A", 150, end(tankFo1, "e"), end(fa518, "in"));
pipe(FO, "FA108-150A", 150, end(fa518, "out"), end(jFo520));
pipe(FO, "FA108-150A", 150, end(jFo520), end(jFoTop));
pipe(FO, "FA108-150A", 150, end(jFo520), end(fa520, "in"));
pipe(FO, "FA108-150A", 150, end(fa520, "out"), end(tankFo2, "e"), { via: [[840, 329]] });
pipe(FO, "FA101-150A", 150, end(jFoTop), end(jFo521));
pipe(FO, "FA101-150A", 150, end(jFo521), end(jFo516));
pipe(FO, "FA101-150A", 150, end(jFo516), end(jFoBottom));
pipe(FO, "100A", 100, end(openFo521, "p"), end(spFo1, "in"));
pipe(FO, "100A", 100, end(spFo1, "out"), end(fa521, "in"));
pipe(FO, "100A", 100, end(fa521, "out"), end(jFo521));
pipe(FO, "FA101-150A", 150, end(jFo516), end(fa516, "in"));
pipe(FO, "FA101-150A", 150, end(fa516, "out"), end(spFo2, "in"));
pipe(FO, "FA101-150A", 150, end(spFo2, "out"), end(spFo3, "in"));
pipe(FO, "FA101-150A", 150, end(spFo3, "out"), end(jFoManifold1), {
  crossings: [{ at: [1298, 541], style: "gap" }],
  note: "Crosses the D.O. manifold line without joining it.",
});
pipe(FO, "FA100-150A", 150, end(jFoManifold1), end(fa515, "in"));
pipe(FO, "FA100-150A", 150, end(fa515, "out"), end(spFo4, "in"));
pipe(FO, "FA100-150A", 150, end(spFo4, "out"), end(jFoManifold2));
pipe(FO, "FA103-150A", 150, end(jFoBottom), end(jFo519));
pipe(FO, "FA103-150A", 150, end(jFo519), end(jFo575));
pipe(FO, "FA103-150A", 150, end(jFo575), end(fa517, "out"));
pipe(FO, "FA103-150A", 150, end(fa517, "in"), end(tankFo4, "e"));
pipe(FO, "FA103-150A", 150, end(jFo519), end(fa519, "out"));
pipe(FO, "FA103-150A", 150, end(fa519, "in"), end(tankFo3, "e"), { via: [[840, 709]] });
pipe(FO, "100A", 100, end(tankFo4, "s"), end(fa575, "in"), { via: [[748, 898]] });
pipe(FO, "65A", 65, end(fa575, "out"), end(jFo575));

// ---------------------------------------------------------------------------------------------------------------
// Cargo manifold area: three manifolds of the same arrangement
// ---------------------------------------------------------------------------------------------------------------

interface ManifoldTags {
  /** Top half, from the end flange down: stop valve, ball valve (drain), ball valve (gauge), main butterfly, gate. */
  top: [string, string, string, string, string];
  /** Bottom half, from the middle down: gate, main butterfly, ball valve (gauge), ball valve (drain), stop valve. */
  bottom: [string, string, string, string, string];
}

/**
 * One manifold riser at `x`: end flanges at both ends; on each half a stop valve and a ball valve to a vent/drain
 * point on the left, a ball valve to a pressure gauge and a gate valve with a blind flange on the right, and the main
 * butterfly valve in the riser. `taps` are where the riser joins the rest of the drawing.
 */
function manifold(code: string, x: number, fluid: string, line: string, bore: number, tags: ManifoldTags, taps: string[]): void {
  const name = fluid === DO ? "D.O." : "F.O.";
  const flange = (suffix: string, y: number, rotation: 0 | 180) =>
    add({
      id: `EQ-${code}-FL-${suffix}`,
      tag: null,
      kind: "end-flange",
      name: `${name} manifold connection (${suffix === "T" ? "top" : "bottom"})`,
      at: [x, y],
      rotation,
      size: 26,
      fluid,
      record: null,
      status: "missing-data",
      note: "Manifold end connection; untagged, no data record.",
    });
  const vent = (suffix: string, y: number, rotation: 0 | 180) =>
    add({
      id: `EQ-${code}-VENT-${suffix}`,
      tag: null,
      kind: "open-end",
      variant: "vent",
      name: `${name} manifold vent / drain point (${suffix === "T" ? "top" : "bottom"})`,
      at: [x - 30, y],
      rotation,
      size: 12,
      fluid,
      record: null,
      status: "missing-data",
      note: "Open discharge symbol (radiating lines); its service isn't stated on the drawing.",
    });
  const gauge = (suffix: string, y: number, valveTag: string) =>
    add({
      id: `EQ-${code}-PI-${suffix}`,
      tag: null,
      kind: "gauge",
      name: `Pressure indicator (PI) on ${valveTag}`,
      at: [x + 44, y],
      rotation: 0,
      size: 12,
      fluid,
      record: null,
      status: "missing-data",
      note: "Drawn as PI with no tag and no data record.",
    });

  const flangeTop = flange("T", 178, 0);
  const flangeBottom = flange("B", 862, 180);
  const ventTop = vent("T", 170, 0);
  const ventBottom = vent("B", 876, 180);

  const half = (part: "top" | "bottom") => {
    const t = part === "top" ? tags.top : tags.bottom;
    const [globeTag, drainTag, gaugeTag, mainTag, gateTag] = part === "top" ? t : [t[4], t[3], t[2], t[1], t[0]];
    const y = part === "top" ? { globe: 194, drain: 229, gauge: 250, main: 280, gate: 311 } : { globe: 847, drain: 811, gauge: 790, main: 758, gate: 730 };
    // The left-hand valves are drawn as printed (unrotated): "out" faces the riser, "in" the vent column. The drawing
    // gives no flow direction for these branches.
    const globe = taggedValve(globeTag, fluid, [x - 14, y.globe], 0, 14, {
      type: "stop valve (globe)",
      variant: "globe",
      candidates: GLOBE,
      note: GLOBE_NOTE,
      label: { at: [x - 54, y.globe + 4] },
    });
    const drain = taggedValve(drainTag, fluid, [x - 14, y.drain], 0, 14, {
      type: "ball valve",
      object: "OBJ-005",
      note: BALL_NOTE,
      label: { at: [x - 54, y.drain + (part === "top" ? 12 : -4)] },
    });
    const toGauge = taggedValve(gaugeTag, fluid, [x + 22, y.gauge], 0, 14, {
      type: "ball valve (gauge)",
      object: "OBJ-005",
      note: BALL_NOTE,
      label: { at: [x + 36, y.gauge + 16] },
    });
    const main = taggedValve(mainTag, fluid, [x, y.main], 90, 22, {
      type: "butterfly valve (manifold)",
      variant: "handwheel",
      candidates: BUTTERFLY,
      note: BUTTERFLY_NOTE,
      label: { at: [x - 16, y.main], rotate: -90 },
    });
    const gate = taggedValve(gateTag, fluid, [x + 27, y.gate], 0, 16, {
      type: "gate valve (blind flanged)",
      variant: "blind",
      note: GATE_NOTE,
      label: { at: [x + 36, y.gate + 15] },
    });
    const pi = gauge(part === "top" ? "T" : "B", y.gauge, gaugeTag);
    const j = (key: string, at: Point) => junction(`J-${code}-${key}`, at);
    const jGlobe = j(`${part}-globe`, [x, y.globe]);
    const jDrain = j(`${part}-drain`, [x, y.drain]);
    const jGauge = j(`${part}-gauge`, [x, y.gauge]);
    const jGate = j(`${part}-gate`, [x, y.gate]);
    const vGlobe = j(`${part}-vent-globe`, [x - 30, y.globe]);
    const vDrain = j(`${part}-vent-drain`, [x - 30, y.drain]);
    pipe(fluid, undefined, undefined, end(jGlobe), end(globe, "out"));
    pipe(fluid, undefined, undefined, end(jDrain), end(drain, "out"));
    pipe(fluid, undefined, undefined, end(jGauge), end(toGauge, "in"));
    pipe(fluid, undefined, undefined, end(jGate), end(gate, "in"));
    pipe(fluid, undefined, undefined, end(globe, "in"), end(vGlobe));
    pipe(fluid, undefined, undefined, end(drain, "in"), end(vDrain));
    pipe(fluid, undefined, undefined, end(toGauge, "out"), end(pi, "in"));
    pipe(fluid, undefined, undefined, end(vGlobe), end(vDrain));
    return { jGlobe, jDrain, jGauge, jGate, main, vGlobe, vDrain };
  };

  const top = half("top");
  const bottom = half("bottom");

  // Vent columns.
  pipe(fluid, undefined, undefined, end(ventTop, "p"), end(top.vGlobe));
  pipe(fluid, undefined, undefined, end(bottom.vGlobe), end(ventBottom, "p"));

  // The riser, top to bottom.
  const riser: PipeEnd[] = [
    end(flangeTop, "p"),
    end(top.jGlobe),
    end(top.jDrain),
    end(top.jGauge),
    end(top.main, "in"),
  ];
  const middle: PipeEnd[] = [end(top.main, "out"), end(top.jGate), ...taps.map((tap) => end(tap)), end(bottom.jGate), end(bottom.main, "in")];
  const lower: PipeEnd[] = [end(bottom.main, "out"), end(bottom.jGauge), end(bottom.jDrain), end(bottom.jGlobe), end(flangeBottom, "p")];
  for (const run of [riser, middle, lower]) for (let i = 0; i < run.length - 1; i += 1) pipe(fluid, line, bore, run[i], run[i + 1]);
}

manifold("DOM", 1298, DO, "FB101-100A", 100, { top: ["FB544", "FB582", "FB572", "FB512", "FB542"], bottom: ["FB541", "FB511", "FB571", "FB581", "FB543"] }, [jDoManifold]);
manifold("FOM1", 1413, FO, "FA102-150A", 150, { top: ["FA548", "FA584", "FA574", "FA514", "FA544"], bottom: ["FA543", "FA513", "FA573", "FA583", "FA547"] }, [jFoManifold1]);
manifold("FOM2", 1820, FO, "FA101-150A", 150, { top: ["FA546", "FA582", "FA572", "FA512", "FA542"], bottom: ["FA541", "FA511", "FA571", "FA581", "FA545"] }, [jFoManifold2]);

// ---------------------------------------------------------------------------------------------------------------
// Text printed on the drawing
// ---------------------------------------------------------------------------------------------------------------

const labels: TextLabel[] = [
  { text: "ACCOMMODATION", at: [350, 495], size: 18 },
  { text: "CARGO MANIFOLD AREA", at: [1655, 390], rotate: -65, size: 16 },
  { text: "D.O", at: [1302, 160], size: 14 },
  { text: "D.O", at: [1302, 886], size: 14 },
  { text: "F.O", at: [1415, 160], size: 14 },
  { text: "F.O", at: [1415, 886], size: 14 },
  { text: "F.O", at: [1822, 160], size: 14 },
  { text: "F.O", at: [1822, 886], size: 14 },
  { text: "FB100-100A", at: [158, 520], rotate: -90 },
  { text: "FB100-100A", at: [122, 258] },
  { text: "FB105-65A", at: [76, 316] },
  { text: "FB104-65A", at: [64, 728] },
  { text: "FB100-100A", at: [912, 394] },
  { text: "FB100-100A", at: [1238, 387] },
  { text: "65A", at: [700, 305] },
  { text: "FA108-150A", at: [738, 146] },
  { text: "FA108-150A", at: [833, 272], rotate: -90 },
  { text: "FA101-150A", at: [971, 260], rotate: -90 },
  { text: "FA101-150A", at: [971, 690], rotate: -90 },
  { text: "100A", at: [908, 448] },
  { text: "FA101-150A", at: [1234, 531] },
  { text: "FA100-150A", at: [1700, 535] },
  { text: "FA103-150A", at: [833, 770], rotate: -90 },
  { text: "FA103-150A", at: [690, 858] },
  { text: "100A", at: [778, 890] },
  { text: "65A", at: [821, 876], rotate: -90 },
  { text: "FB101-100A", at: [1291, 340], rotate: -90 },
  { text: "FB101-100A", at: [1291, 470], rotate: -90 },
  { text: "FB101-100A", at: [1291, 670], rotate: -90 },
  { text: "FA102-150A", at: [1406, 390], rotate: -90 },
  { text: "FA102-150A", at: [1406, 660], rotate: -90 },
  { text: "FA101-150A", at: [1813, 400], rotate: -90 },
  { text: "FA101-150A", at: [1813, 650], rotate: -90 },
];

export const schematic: Schematic = {
  id: "SEC-001",
  width: 2000,
  height: 1000,
  fluids: {
    [DO]: { id: DO, label: "Diesel oil (D.O.)", color: "#3fb4ee" },
    [FO]: { id: FO, label: "Fuel oil (F.O.)", color: "#d4151c" },
  },
  equipment,
  junctions,
  pipes,
  labels,
};

export default schematic;
