import { VIEWER_SOURCE, type ViewerCommand } from "@/lib/viewer-protocol";

/**
 * A ship's viewer: its own project in child/ships/<folder>, built and deployed on its own. This app serves it on its
 * own origin under /child/<folder>/ by proxying to wherever it's hosted (SHIP_VIEWER_URL, see next.config.ts): the
 * child's Vite dev server in development, the ships' static host in production.
 */
export function viewerUrl(shipFolder: string): string {
  return `/child/${encodeURIComponent(shipFolder)}/index.html`;
}

/** Omit distributed over each member of a union. */
type WithoutSource<T> = T extends unknown ? Omit<T, "source"> : never;

/** Sends a command to the viewer iframe. Does nothing if the iframe isn't mounted. */
export function postToViewer(frame: HTMLIFrameElement | null, command: WithoutSource<ViewerCommand>) {
  frame?.contentWindow?.postMessage({ source: VIEWER_SOURCE, ...command } satisfies ViewerCommand, window.location.origin);
}
