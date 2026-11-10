"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { isCodegenActive } from "@/lib/codegen";
import { generateCode, restoreCodeVersion, stopCodeGeneration } from "@/lib/codegen-api";
import { formatDateTime } from "@/lib/format";
import { PlanUsagePanel } from "@/components/records/PlanUsagePanel";
import type {
  CodegenLimit,
  CodegenObjects,
  CodegenStatus,
  CodegenVersion,
  Section,
  SectionCodegen,
  SharedChange,
} from "@/types/records";

/**
 * A section's AI-generated 2D and 3D React code (see src/server/codegen/): its status and version in the Sections
 * table, its details and versions in the View modal (read-only), and in the Edit form "Generate again", "Stop", and
 * its versions, each of which can be restored.
 */

const STATUS: Record<CodegenStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  running: { label: "Generating…", className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  done: { label: "2D + 3D ready", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 ring-red-200" },
  cancelled: { label: "Stopped", className: "bg-amber-50 text-amber-700 ring-amber-200" },
};

const MODE_LABEL = {
  first: "First prompt: created the ship's shared components",
  second: "Second prompt: reused the ship's shared components",
} as const;

const LIMIT_LABEL: Record<CodegenLimit, string> = {
  turns: "turns, CODEGEN_MAX_TURNS",
  fixRounds: "rounds of fixes, CODEGEN_FIX_ROUNDS",
};

/** section.json can be edited by hand, or come from an earlier version, so a limit it names may no longer exist. */
function limitLabel(limit: CodegenLimit): string {
  return LIMIT_LABEL[limit] ?? "a limit that no longer applies";
}

/** Said while a generation waits for the Claude plan's usage limit to reset (src/server/codegen/plan.ts). */
function waitingNote(waitingUntil: string) {
  return `The Claude plan's usage limit is reached: this generation waits until ${formatDateTime(waitingUntil)}, then starts again on its own.`;
}

/** E.g. "v2 in use · 3 versions". */
function versionSummary(section: Section): string | undefined {
  const count = section.codegenVersions?.length ?? 0;
  if (!section.codegenVersion) return undefined;
  return `v${section.codegenVersion} in use${count > 1 ? ` · ${count} versions` : ""}`;
}

function StatusPill({ codegen }: { codegen: SectionCodegen }) {
  const { label, className } =
    codegen.status === "queued" && codegen.waitingUntil
      ? { label: "Waiting for plan limit", className: "bg-amber-50 text-amber-700 ring-amber-200" }
      : STATUS[codegen.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${className}`}
    >
      {isCodegenActive(codegen) && <Spinner className="size-3" />}
      {label}
    </span>
  );
}

/** The Sections table's Code column. */
export function CodegenCell({ section }: { section: Section }) {
  const { codegen } = section;
  if (!codegen) {
    return section.lineDiagram ? (
      <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-400">
        Not generated
      </span>
    ) : (
      <span className="text-sm text-slate-400">Needs a line diagram</span>
    );
  }
  const detail =
    codegen.status === "running"
      ? codegen.progress
      : codegen.status === "failed"
        ? codegen.error
        : codegen.status === "queued" && codegen.waitingUntil
          ? `Starts again after ${formatDateTime(codegen.waitingUntil)}`
          : undefined;
  const version = versionSummary(section);
  return (
    <div className="min-w-0">
      <StatusPill codegen={codegen} />
      {detail && (
        <p className="mt-1 max-w-48 truncate text-xs text-slate-500" title={detail}>
          {detail}
        </p>
      )}
      {version && <p className="mt-0.5 text-xs font-medium whitespace-nowrap text-slate-600">{version}</p>}
    </div>
  );
}

/** The Generated code box, with the generation's status in its header. */
function CodegenFrame({ codegen, children }: { codegen?: SectionCodegen; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Generated code</h3>
        {codegen && <StatusPill codegen={codegen} />}
      </div>
      <div className="space-y-3 p-4 text-sm">
        {children}
        <PlanUsagePanel />
      </div>
    </section>
  );
}

interface VersionListProps {
  section: Section;
  /** The ship's folder, relative to child/, e.g. "ships/mv-aurora". */
  shipDir?: string;
  /** Restores a version; without it the list is read-only. Rejects when it couldn't (a toast has said why). */
  onRestore?: (version: number) => Promise<void>;
  /** Restoring isn't possible right now (the section's code is being generated). */
  blocked?: boolean;
}

/** The section's code versions, newest first. */
function VersionList({ section, shipDir, onRestore, blocked = false }: VersionListProps) {
  const versions = [...(section.codegenVersions ?? [])].reverse();
  if (versions.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-slate-500">
        {shipDir ? (
          <>
            Versions, kept in <span className="font-mono">child/{shipDir}/codegen/{section.id}/</span>
          </>
        ) : (
          "Versions"
        )}
      </p>
      <ul className="mt-1 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
        {versions.map((version) => (
          <VersionRow
            key={version.version}
            version={version}
            inUse={version.version === section.codegenVersion}
            blocked={blocked}
            onRestore={onRestore && (() => onRestore(version.version))}
          />
        ))}
      </ul>
    </div>
  );
}

interface CodegenControlsProps {
  projectId: string;
  section: Section;
  /** Reloads the sections, after a generation is started or stopped, or a version restored. */
  onChanged: () => Promise<void>;
  /**
   * Why "Generate again" can't be used right now, e.g. the form has a new line diagram that isn't saved yet (a
   * generation always uses the saved one).
   */
  pending?: string;
  /** The form is being saved. */
  disabled?: boolean;
}

/** The Edit form's Generated code section: "Generate again" (or "Stop"), and the versions, each of which can be restored. */
export function CodegenControls({ projectId, section, onChanged, pending, disabled = false }: CodegenControlsProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { codegen } = section;
  const active = isCodegenActive(codegen);

  async function restore(version: number) {
    try {
      await restoreCodeVersion(projectId, section.id, version);
      await onChanged();
      toast.success(`Switched to v${version}`, `${section.id} · ${section.name}`);
    } catch (error) {
      toast.error(`Couldn't switch to v${version}`, error instanceof Error ? error.message : undefined);
      throw error;
    }
  }

  async function run(action: "generate" | "stop") {
    setBusy(true);
    try {
      if (action === "generate") await generateCode(projectId, section.id);
      else await stopCodeGeneration(projectId, section.id);
      await onChanged();
    } catch (error) {
      toast.error(
        action === "generate" ? "Couldn't start generating code" : "Couldn't stop generating code",
        error instanceof Error ? error.message : undefined,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <CodegenFrame codegen={codegen}>
      {!codegen ? (
        <p className="text-slate-500">
          {section.lineDiagram
            ? "No code has been generated from this line diagram yet."
            : "Upload a line diagram above, and 2D and 3D React code will be generated from it when you save."}
        </p>
      ) : (
        <>
          {codegen.status === "queued" &&
            (codegen.waitingUntil ? (
              <p className="text-amber-800">{waitingNote(codegen.waitingUntil)}</p>
            ) : (
              <p className="text-slate-500">Waiting for other generations to finish: they run one at a time, across ships.</p>
            ))}
          {codegen.status === "running" && codegen.progress && <p className="text-indigo-700">{codegen.progress}…</p>}
          {codegen.error && (
            <p className="max-h-32 overflow-y-auto rounded-lg bg-red-50 px-3 py-2 whitespace-pre-wrap text-red-700 ring-1 ring-red-100">
              {codegen.error}
            </p>
          )}
        </>
      )}
      {/* Switching while code is being generated would mix the two. */}
      <VersionList section={section} onRestore={restore} blocked={active || disabled} />
      {(active || section.lineDiagram) && (
        <div className="flex items-center justify-end gap-3">
          {pending && !active && <p className="mr-auto text-xs text-slate-500">{pending}</p>}
          {active ? (
            <Button variant="secondary" size="sm" loading={busy} disabled={disabled} onClick={() => void run("stop")}>
              Stop
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              disabled={disabled || Boolean(pending)}
              onClick={() => void run("generate")}
            >
              {codegen ? "Generate again" : "Generate code"}
            </Button>
          )}
        </div>
      )}
    </CodegenFrame>
  );
}

interface CodegenPanelProps {
  section: Section;
  /** The ship's folder, relative to child/, e.g. "ships/mv-aurora", which the generated files' paths start from. */
  shipDir: string;
}

/** The View modal's Generated code section: read-only; generating and restoring are done in the Edit form. */
export function CodegenPanel({ section, shipDir }: CodegenPanelProps) {
  const { codegen } = section;
  const usage = codegen?.usage;
  const tokens = (count: number) => count.toLocaleString("en-US");
  const times = codegen && [
    codegen.startedAt && { label: "Started", value: formatDateTime(codegen.startedAt) },
    codegen.finishedAt && { label: "Finished", value: formatDateTime(codegen.finishedAt) },
    usage && { label: "Input tokens", value: tokens(usage.inputTokens + usage.cacheCreationInputTokens + usage.cacheReadInputTokens) },
    usage && { label: "Output tokens", value: tokens(usage.outputTokens) },
    typeof usage?.turns === "number" && { label: "Turns", value: String(usage.turns) },
  ];

  return (
    <CodegenFrame codegen={codegen}>
      {!codegen ? (
        <p className="text-slate-500">
          {section.lineDiagram
            ? "No code has been generated from this line diagram yet. Use Edit to generate it."
            : "Upload a line diagram with Edit, and 2D and 3D React code will be generated from it."}
        </p>
      ) : (
        <>
          {codegen.mode && <p className="text-slate-700">{MODE_LABEL[codegen.mode]}.</p>}
          {codegen.objects && <ObjectsNote objects={codegen.objects} />}
          {codegen.status === "queued" &&
            (codegen.waitingUntil ? (
              <p className="text-amber-800">{waitingNote(codegen.waitingUntil)}</p>
            ) : (
              <p className="text-slate-500">Waiting for other generations to finish: they run one at a time, across ships.</p>
            ))}
          {codegen.status === "running" && codegen.progress && <p className="text-indigo-700">{codegen.progress}…</p>}
          {codegen.limit && (
            <p className="text-red-700">Stopped by its limit ({limitLabel(codegen.limit)}); nothing it wrote was kept.</p>
          )}
          {codegen.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 whitespace-pre-wrap text-red-700 ring-1 ring-red-100">{codegen.error}</p>
          )}
          {codegen.summary && (
            <p className="max-h-48 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 whitespace-pre-wrap text-slate-700 ring-1 ring-slate-200">
              {codegen.summary}
            </p>
          )}
          {codegen.sharedChange && <SharedChangeNote change={codegen.sharedChange} />}
          {times?.some(Boolean) && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {times.map(
                (item) =>
                  item && (
                    <div key={item.label}>
                      <dt className="text-xs text-slate-500">{item.label}</dt>
                      <dd className="mt-0.5 text-slate-900">{item.value}</dd>
                    </div>
                  ),
              )}
            </dl>
          )}
          {codegen.files && codegen.files.length > 0 && (
            <div>
              <p className="text-xs text-slate-500">
                Files written, in <span className="font-mono">child/{shipDir}/</span>
              </p>
              <ul className="mt-1 space-y-0.5 font-mono text-xs break-all text-slate-700">
                {codegen.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <VersionList section={section} shipDir={shipDir} />
    </CodegenFrame>
  );
}

/**
 * How a generation used the section's objects: whose images it looked at (and wrote cards for), and which it placed
 * from their cards without their images. section.json can be edited by hand, so the lists are checked.
 */
function ObjectsNote({ objects }: { objects: CodegenObjects }) {
  const ids = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
  const [learned, reused, skipped] = [ids(objects.learned), ids(objects.reused), ids(objects.skipped)];
  const parts = [
    learned.length > 0 && `looked at the images of ${learned.join(", ")} and saved their cards`,
    reused.length > 0 && `placed ${reused.join(", ")} from their cards, without sending their images`,
    skipped.length > 0 && `didn't look at ${skipped.join(", ")} yet`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-slate-700">Objects: {parts.join("; ")}.</p>;
}

/**
 * What happened to a generation's change to the template, in records from when generations could change it (they no
 * longer can: every ship runs the shared viewer in child/core, which only people change).
 */
function SharedChangeNote({ change }: { change: SharedChange }) {
  const files = (
    <ul className="mt-1 space-y-0.5 font-mono text-xs break-all">
      {change.files.map((file) => (
        <li key={file}>{file}</li>
      ))}
    </ul>
  );
  const checked = change.checkedShips.length
    ? `Checked against ${change.checkedShips.join(", ")}.`
    : "No other ship has these files, so none had to be checked.";
  if (change.status === "kept") {
    return (
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-100">
        <p>
          Template updated for new ships. {checked}
        </p>
        {files}
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
      <p>
        The change to the template was rejected and undone; it stays in this ship only. {checked}
      </p>
      {files}
      {change.reason && <p className="mt-2 max-h-48 overflow-y-auto text-xs whitespace-pre-wrap">{change.reason}</p>}
    </div>
  );
}

interface VersionRowProps {
  version: CodegenVersion;
  /** Its files are the section's code now. */
  inUse: boolean;
  /** Restoring isn't possible right now (the section's code is being generated). */
  blocked: boolean;
  /** Without it there's no Restore button (the View modal). Rejects when it couldn't restore (a toast has said why). */
  onRestore?: () => Promise<void>;
}

/** One of a section's code versions. Restoring it asks first, in place (the Edit form is already a dialog). */
function VersionRow({ version, inUse, blocked, onRestore }: VersionRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (!onRestore) return;
    setBusy(true);
    try {
      await onRestore();
      setConfirming(false);
    } catch {
      // The panel's toast says why; the question stays open to try again or cancel.
    } finally {
      setBusy(false);
    }
  }

  const details = [
    formatDateTime(version.finishedAt),
    version.mode === "first" ? "First prompt" : "Second prompt",
    version.lineDiagramName,
  ].filter(Boolean);

  return (
    <li className="px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 font-mono text-xs font-semibold text-slate-900">v{version.version}</span>
        <p className="min-w-0 flex-1 truncate text-xs text-slate-500" title={details.join(" · ")}>
          {details.join(" · ")}
        </p>
        {inUse ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
            In use
          </span>
        ) : (
          onRestore &&
          !confirming && (
            <Button
              variant="ghost"
              size="sm"
              disabled={blocked}
              title={blocked ? "Wait until the code generation finishes" : undefined}
              onClick={() => setConfirming(true)}
            >
              Restore
            </Button>
          )
        )}
      </div>
      {confirming && !inUse && (
        <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
          <p>
            Replace this section&apos;s generated files with v{version.version}&apos;s? Changes made to them since are
            lost. The ship&apos;s shared components stay as they are, so v{version.version} is only restored if it still
            works with them.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={busy} disabled={blocked} onClick={() => void restore()}>
              Restore v{version.version}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
