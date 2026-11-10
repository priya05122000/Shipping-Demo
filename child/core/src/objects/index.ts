// "@shipdocs/viewer-core/objects": the ship's objects from the Library, for 2D views.
export { findObject, objectPort } from "./lookup";
export type { ObjectBox, SharedObject } from "./registry";
export type { ObjectCard, ObjectCardPort } from "./card";
export { ObjectSymbol2D, type ObjectSymbol2DProps } from "./ObjectSymbol2D";
// ObjectModel3D is imported from "@shipdocs/viewer-core/objects/model3d" itself, so 2D views don't load three.js.
