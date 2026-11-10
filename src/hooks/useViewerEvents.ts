"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import { parseViewerEvent, type ViewerEvent } from "@/lib/viewer-protocol";

/**
 * Calls `onEvent` for each valid event the viewer iframe posts. Messages from other windows or origins, and ones that
 * don't match the protocol (see viewer-protocol.ts), are ignored.
 */
export function useViewerEvents(frameRef: RefObject<HTMLIFrameElement | null>, onEvent: (event: ViewerEvent) => void) {
  const handle = useEffectEvent(onEvent);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      const parsed = parseViewerEvent(event.data);
      if (parsed) handle(parsed);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef]);
}
