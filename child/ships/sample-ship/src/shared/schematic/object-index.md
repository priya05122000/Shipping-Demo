# Library object index (Sample Ship)

Reference for matching this ship's Library objects (`src/objects/<id>/`) to equipment in new sections. Each object's
`card.json` is the source of truth for its kind, description, aspect and ports; ports are fractions of the 2D image
(x from the left, y from the top). "Engine kind" is the `PartKind` the pipeline schematic draws it as.

| ID | Name | Kind | Engine kind | Aspect (w ÷ h) | Ports | 2D image | 3D (PNG stand-in) | Used in |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OBJ-001 | Butterfly Valve | butterfly valve (front view) | `BFV` | 0.667 | in (0.34, 0.655), out (0.66, 0.655) | `butterfly-valve-2d-c577b15f.png` | `butterfly-valve-3d-d9b81c98.png` | bunker, emergency-fuel-tank |
| OBJ-003 | Globe Valve | globe valve | `GLV` | 1.07 | in (0.16, 0.745), out (0.84, 0.745) | `globe-valve-2d-b8c10014.png` | `globe-valve-3d-a1930b35.png` | bunker, emergency-fuel-tank |
| OBJ-004 | Ball Valve | ball valve | `BV` | 2.003 | in (0.02, 0.715), out (0.57, 0.715) | `ball-valve-2d-c47cf267.png` | `ball-valve-3d-6c7f9de9.png` | bunker, emergency-fuel-tank |
| OBJ-005 | Hydrant Landing Valve | hydrant landing valve | `HV` | 1.333 | in (0.18, 0.71), out (0.88, 0.7) | `hydrant-landing-valve-2d-14beb2d6.png` | `hydrant-landing-valve-3d-97d71d72.png` | bunker (`HV-*`), emergency-fuel-tank (V-005) |
| OBJ-009 | Red Glass Tank | tank (glass cylinder) | `TK`, `tankColor: "red"` | 0.723 | top (0.5, 0.04), bottom (0.5, 0.97) | `red-glass-tank-2d-c79a7f52.png` | `red-glass-tank-3d-e77a3aa1.png` | bunker (F.O tanks), emergency-fuel-tank |

Descriptions (from the cards):

- **OBJ-001**: front view along the pipe of a lug-type butterfly valve, red body, blue seat rings, red gearbox, large
  blue four-spoked handwheel on top. The pipe passes through the body into the picture.
- **OBJ-003**: side view of a flanged globe valve, red body, blue flanges and bonnet, brass stem, blue spoked
  handwheel on top. Pipe runs left to right through the flanges.
- **OBJ-004**: side view of a two-piece screwed ball valve, salmon-red body, blue hex ends, long blue lever to the
  upper right. Pipe runs left to right through the ends.
- **OBJ-005**: side view of a hydrant landing valve, salmon-red globe-pattern body, blue inlet flange on the left,
  blue handwheel on top, blue hose coupling (red lugs, wire lanyard) on the right. Pipe enters at the left flange; the
  coupling is an open hose outlet, so it goes at the end of a branch (`pipes.out: null`). Drawing symbol: a valve with
  a small rectangle (the coupling) on its outlet.
- **OBJ-009**: upright red-tinted glass cylinder with red end plates; no nozzles drawn.

Not indexed yet (no card written): OBJ-002, OBJ-006, OBJ-007, OBJ-008. Their names are in their `object.json`; the
bunker schematic draws them as `PSV`, `MBV`, `DJ` and `TK` (blue) respectively.

No object for a plain **gate valve** exists among the indexed objects. (emergency-fuel-tank's V-005 is recorded as a
gate valve in its manual-data.json but drawn with a hose coupling, so it uses OBJ-005.)
