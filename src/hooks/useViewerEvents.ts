"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";
import type { ViewerEvent } from "@child/protocol";
import { isViewerEvent } from "@/lib/viewer-bridge";

/** Calls `onEvent` for each event the viewer iframe posts. Messages from other windows or origins are ignored. */
export function useViewerEvents(frameRef: RefObject<HTMLIFrameElement | null>, onEvent: (event: ViewerEvent) => void) {
  const handle = useEffectEvent(onEvent);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (isViewerEvent(event.data)) handle(event.data);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef]);
}
