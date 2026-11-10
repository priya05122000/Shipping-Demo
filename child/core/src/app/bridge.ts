import { useEffect, useEffectEvent } from "react";
import type { ViewerCommand, ViewerEvent, ViewerSource } from "./protocol";

const SOURCE: ViewerSource = "ship-viewer";

/** True when the viewer runs inside the parent's iframe rather than as a standalone page. */
export const isEmbedded = window.parent !== window;

/** Omit distributed over each member of a union. */
type WithoutSource<T> = T extends unknown ? Omit<T, "source"> : never;

/** Posts an event to the parent. A no-op when running standalone. */
export function postToParent(event: WithoutSource<ViewerEvent>) {
  if (!isEmbedded) return;
  // The parent proxies the viewer under /child on its own origin (wherever the viewer is hosted), so only that origin
  // may receive events.
  window.parent.postMessage({ source: SOURCE, ...event } satisfies ViewerEvent, window.location.origin);
}

function isViewerCommand(data: unknown): data is ViewerCommand {
  const message = data as Partial<ViewerCommand> | null;
  return message?.source === SOURCE && message.type === "open-section" && typeof message.sectionId === "string";
}

/** Calls `onCommand` for each valid command the parent sends. */
export function useParentCommands(onCommand: (command: ViewerCommand) => void) {
  const handle = useEffectEvent(onCommand);
  useEffect(() => {
    if (!isEmbedded) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (isViewerCommand(event.data)) handle(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
