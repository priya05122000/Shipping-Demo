"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SectionSummary, SelectedItem, ViewerEvent } from "@/lib/viewer-protocol";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon, ExternalIcon, ShipIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useViewerEvents } from "@/hooks/useViewerEvents";
import { postToViewer, viewerUrl } from "@/lib/viewer-bridge";
import { useProject } from "../../_components/ProjectWorkspace";

/** How long to wait for the viewer's "ready" event before showing an error. */
const LOAD_TIMEOUT_MS = 15_000;

/** "missing": there's no viewer for this ship (e.g. a build from before it was added), or it's another ship's. */
type Status = "loading" | "ready" | "missing" | "failed";

/**
 * Embeds the viewer app in an iframe, showing the current ship, and drives it: picks the drawing, and shows what's
 * selected inside it. Inside ProjectWorkspace.
 */
export function ViewerHost() {
  const project = useProject();
  const src = viewerUrl(project.folder);
  const searchParams = useSearchParams();
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Changing the key remounts the iframe, which is how "Try again" reloads it.
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  // A ship added since the ships were last built and deployed has no viewer yet: say so rather than wait for "ready".
  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        if (!cancelled && response.status === 404) setStatus("missing");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src, attempt]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("failed"), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [status, attempt]);

  function showSection(id: string, item: SelectedItem | null = null) {
    setSectionId(id);
    setSelected(item);
    // Native history updates sync with useSearchParams without a server round trip.
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", id);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }

  useViewerEvents(frameRef, (event: ViewerEvent) => {
    switch (event.type) {
      case "ready": {
        // Sent again whenever the viewer reloads, so restore the drawing the user was on (or the ?section= link).
        setStatus(event.shipId === project.id ? "ready" : "missing");
        setSections(event.sections);
        if (event.sectionId === null) {
          // The viewer has no drawings.
          setSectionId(null);
          setSelected(null);
          break;
        }
        const wanted = sectionId ?? searchParams.get("section");
        const target = event.sections.find((s) => s.id === wanted)?.id ?? event.sectionId;
        if (target === event.sectionId) {
          showSection(target, event.item);
        } else {
          postToViewer(frameRef.current, { type: "open-section", sectionId: target });
          showSection(target);
        }
        break;
      }
      case "section-changed":
        showSection(event.sectionId);
        break;
      case "item-selected":
        setSelected(event.item);
        break;
    }
  });

  function openSection(id: string) {
    // Record the choice now, not on the viewer's echo: if the viewer is mid-reload the command is lost,
    // and the next "ready" re-sends whatever is recorded here.
    showSection(id);
    postToViewer(frameRef.current, { type: "open-section", sectionId: id });
  }

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  return (
    <section aria-label="Viewer" className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_2px_4px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.10),0_20px_40px_-12px_rgb(15_23_42/0.20)]">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-6">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Drawing
          <select
            value={sectionId ?? ""}
            disabled={status !== "ready" || sections.length === 0}
            onChange={(event) => openSection(event.target.value)}
            className="h-9 min-w-48 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-xs focus:outline-2 focus:-outline-offset-1 focus:outline-indigo-600 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {sections.length === 0 && <option value="">{status === "ready" ? "No drawings" : "Loading…"}</option>}
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
        <p className="min-w-0 truncate text-sm text-slate-500" aria-live="polite">
          {selected ? (
            <>
              Selected:{" "}
              <span className="font-medium text-slate-900">
                {selected.id} · {selected.label}
              </span>
            </>
          ) : (
            "Nothing selected"
          )}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 ring-inset hover:bg-slate-50 sm:ml-auto sm:self-auto"
        >
          <ExternalIcon className="size-4" /> Open standalone
        </a>
      </div>

      <div className="relative h-[70vh] min-h-120">
        <iframe key={attempt} ref={frameRef} src={src} title={`Viewer for ${project.name}`} className="block size-full" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            {status === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Spinner className="size-4" /> Loading viewer…
              </p>
            ) : status === "missing" ? (
              <EmptyState
                icon={<ShipIcon className="size-6" />}
                title="This ship's viewer isn't deployed yet"
                description={`While npm run dev runs, new ships show up straight away. Otherwise, build it (npm run build:ships -- ${project.folder}) and deploy child/dist/${project.folder}/ to the ships' host.`}
                action={
                  <Button variant="secondary" onClick={retry}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<AlertIcon className="size-6 text-red-500" />}
                title="Viewer didn't load"
                description="In development, make sure the child dev server is running (npm run dev:child). Otherwise, check that SHIP_VIEWER_URL points at the ships' host. Then try again."
                action={
                  <Button variant="secondary" onClick={retry}>
                    Try again
                  </Button>
                }
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
