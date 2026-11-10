import type { PluginOption, UserConfig } from "vite";

/** Glob patterns of the 3D model formats, for `assetsInclude`. */
export declare const MODEL_ASSETS: string[];

/** The plugins a ship's viewer needs: its data ("virtual:ship-manifest"), its "@/" imports, React and Tailwind. */
export declare function shipViewer(): PluginOption[];

/** The Vite config of one ship's project, with `overrides` merged in. */
export declare function defineShipConfig(overrides?: UserConfig): UserConfig;
