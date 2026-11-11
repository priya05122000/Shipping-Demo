import manifest from "virtual:ship-manifest";
import { mountShip } from "@shipdocs/viewer-core";
import "./styles.css";

// The viewer is @shipdocs/viewer-core, shared by every ship; the manifest is this ship's data (ship.json, src/sections, src/objects).
mountShip(manifest);
