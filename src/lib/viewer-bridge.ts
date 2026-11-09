import type { ViewerCommand, ViewerEvent, ViewerSource } from "@child/protocol";

/**
 * A ship's viewer: its own project in child/ships/<folder>, served on this origin under /child/<folder>/
 * (by Vite in dev, from public/child after a build).
 */
export function viewerUrl(shipFolder: string): string {
  return `/child/${encodeURIComponent(shipFolder)}/index.html`;
}

const SOURCE: ViewerSource = "ship-viewer";

const EVENT_TYPES = new Set<string>(["ready", "section-changed", "item-selected"] satisfies ViewerEvent["type"][]);

/** Omit distributed over each member of a union. */
type WithoutSource<T> = T extends unknown ? Omit<T, "source"> : never;

export function isViewerEvent(data: unknown): data is ViewerEvent {
  const message = data as Partial<ViewerEvent> | null;
  return message?.source === SOURCE && typeof message.type === "string" && EVENT_TYPES.has(message.type);
}

/** Sends a command to the viewer iframe. Does nothing if the iframe isn't mounted. */
export function postToViewer(frame: HTMLIFrameElement | null, command: WithoutSource<ViewerCommand>) {
  frame?.contentWindow?.postMessage({ source: SOURCE, ...command } satisfies ViewerCommand, window.location.origin);
}
