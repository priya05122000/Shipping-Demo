import { defineShipConfig } from "@shipdocs/viewer-core/vite";

/**
 * This ship's viewer, a project of its own: `npm run dev`, or `npm run build` for a static site in dist/ that can be
 * hosted at any path. The viewer itself (its UI, how it reads this ship's data, this config) is @shipdocs/viewer-core
 * (child/core), shared by every ship, so a change there reaches this ship the next time it's built.
 */
export default defineShipConfig();
