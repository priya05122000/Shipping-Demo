import fs from "node:fs/promises";
import path from "node:path";
import {
  CODEGEN_ENTRY_2D,
  CODEGEN_ENTRY_3D,
  CODEGEN_STATE_FILE,
  codegenVersionDir,
  isCodegenActive,
  readCodegen,
} from "@/lib/codegen";
import { getExtension } from "@/lib/files";
import { errorCode, writeAtomic } from "@/server/child-dir";
import { ApiError, findCodegenTarget, patchSectionCodegen, type CodegenState, type CodegenTarget } from "@/server/storage";
import type { CodegenMode, CodegenVersion, SectionCodegen } from "@/types/records";
import { AgentError, runAgent, type ImageMediaType } from "./agent";
import { CodegenPolicy, FileJournal, listGeneratedFiles } from "./policy";
import { renderPrompt, type PromptValues } from "./prompts";
import { queueRun, runtime, type Job } from "./runtime";
import { formatDiagnostics, newDiagnostics, typecheck, typecheckReport } from "./typecheck";

/**
 * Generates a section's 2D and 3D React code from its line diagram, with the Claude Agent SDK (see agent.ts):
 *   1. Uploading a line diagram queues a generation in section.json (storage.ts); the API route then calls
 *      reconcileCodegen, which starts a job for it, and stops a job still working on an older one.
 *   2. A ship's jobs run one at a time, since they share the ship's components. When a job's turn comes, the ship's
 *      codegen/generations.json decides the prompt: "first" if it lists no finished generation, "second" if it does.
 *   3. The agent writes the code into the ship's project: the section's Diagram2D.tsx and Diagram3D.tsx, and shared
 *      components in src/shared/schematic/. The job then checks that both entry files exist and that the project has
 *      no new type errors, so `npm run build` keeps working.
 *   4. If that fails or the job is stopped, every file the agent wrote is put back as it was. If it succeeds, the
 *      section's generated files become its next version (v1, v2…): copied to codegen/<section ID>/v<N>/ and listed
 *      in section.json, so restoreCodegenVersion can switch back to it. Either way the outcome is saved in section.json.
 * Jobs live in this server process: one that's queued or running when the server stops shows as interrupted.
 */

const SUMMARY_MAX = 4000;
const STATE_MAX = 100;
const ROLLBACK_DELAY_MS = 1000;

const IMAGE_TYPES: Record<string, ImageMediaType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function jobKey(projectId: string, sectionId: string) {
  return `${projectId}/${sectionId}`;
}

function now() {
  return new Date().toISOString();
}

function cancel(job: Job, reason: string) {
  job.cancelReason ??= reason;
  job.controller.abort();
}

/**
 * Brings a section's job in line with its saved record, after a save: starts a job for a generation queued by this
 * server process, and stops a job whose generation was replaced or whose line diagram was removed.
 */
export function reconcileCodegen(projectId: string, record: { id: string } & Record<string, unknown>) {
  const key = jobKey(projectId, record.id);
  const codegen = readCodegen(record.codegen);
  const lineDiagram = (record.lineDiagram as { storedName?: unknown } | undefined)?.storedName;
  const current = codegen && isCodegenActive(codegen) && codegen.lineDiagram === lineDiagram ? codegen : undefined;
  const job = runtime.jobs.get(key);
  if (job && job.runId !== current?.runId) {
    cancel(job, lineDiagram ? "Replaced by a newer generation." : "The line diagram was removed.");
  }
  // A queued generation this process doesn't know is left from before a restart; it isn't restarted by a save.
  if (current?.status === "queued" && runtime.runs.has(current.runId) && runtime.jobs.get(key)?.runId !== current.runId) {
    startJob(projectId, record.id, current.runId);
  }
}

/** "Generate again": queues a new generation from the section's current line diagram, and starts it. */
export async function requestCodegen(projectId: string, sectionId: string) {
  const result = await patchSectionCodegen(projectId, sectionId, (_state, section) => {
    if (!section.lineDiagram) throw new ApiError(400, "Upload a line diagram first: the code is generated from it.");
    return { codegen: queueRun(section.lineDiagram.storedName) };
  });
  if (!result) throw new ApiError(404, `${sectionId} no longer exists.`);
  reconcileCodegen(projectId, result.record);
}

/** Stops a section's generation and waits until its files are rolled back. */
export async function cancelCodegen(projectId: string, sectionId: string) {
  if (await stopCodegen(projectId, sectionId, "Stopped.")) return;
  // Nothing runs it in this process (it was queued before a restart): just mark it as stopped.
  await patchSectionCodegen(projectId, sectionId, ({ codegen }) =>
    codegen && isCodegenActive(codegen)
      ? { codegen: { ...codegen, status: "cancelled", finishedAt: now(), error: "Stopped." } }
      : undefined,
  );
}

/** Settles once the job, and any it replaced that may still be rolling back, have finished. */
function finished(job: Job): Promise<void> {
  return Promise.all([job.done, job.replaced]).then(() => undefined);
}

/**
 * Stops a section's job, if it has one, and waits until it (and any job it replaced) has rolled back, so nothing
 * writes into the section's folder afterwards. Returns whether there was one.
 */
export async function stopCodegen(projectId: string, sectionId: string, reason: string): Promise<boolean> {
  const key = jobKey(projectId, sectionId);
  // A restore takes seconds and can't be stopped halfway, so it's waited for.
  await runtime.restores.get(key);
  const job = runtime.jobs.get(key);
  if (!job) return false;
  cancel(job, reason);
  await finished(job);
  return true;
}

/** Stops every job of a ship (before it's deleted), and waits until they've rolled back and its restores are done. */
export async function stopShipCodegen(projectId: string, reason: string) {
  const jobs = [...runtime.jobs.values()].filter((job) => job.projectId === projectId);
  for (const job of jobs) cancel(job, reason);
  const restores = [...runtime.restores].filter(([key]) => key.startsWith(`${projectId}/`)).map(([, done]) => done);
  await Promise.all([...jobs.map(finished), ...restores]);
}

function startJob(projectId: string, sectionId: string, runId: string) {
  const key = jobKey(projectId, sectionId);
  // A job this one replaces (already cancelled by reconcileCodegen) may still be rolling back.
  const earlier = runtime.jobs.get(key);
  const job: Job = {
    key,
    projectId,
    sectionId,
    runId,
    controller: new AbortController(),
    done: Promise.resolve(),
    replaced: earlier ? finished(earlier) : Promise.resolve(),
  };
  runtime.jobs.set(key, job);
  const previous = runtime.queues.get(projectId) ?? Promise.resolve();
  job.done = runJob(job, previous)
    .catch((error) => console.error(`Code generation for ${key} failed unexpectedly:`, error))
    .finally(() => {
      if (runtime.jobs.get(key) === job) runtime.jobs.delete(key);
      runtime.runs.delete(runId);
    });
  // The next job of this ship waits for this one and every one before it (a stopped job can finish early).
  const tail: Promise<void> = Promise.all([previous, job.done]).then(() => {
    if (runtime.queues.get(projectId) === tail) runtime.queues.delete(projectId);
  });
  runtime.queues.set(projectId, tail);
}

function whenAborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

function setProgress(job: Job, step: string) {
  const run = runtime.runs.get(job.runId);
  if (run) run.progress = step;
}

/**
 * Saves the job's status in section.json, unless the section has moved on to another generation (or is gone).
 * `update` gets the section's current generation and fields, and returns the new generation, plus any other fields.
 */
async function save(
  job: Job,
  update: (current: SectionCodegen, state: CodegenState) => SectionCodegen | (Partial<CodegenState> & { codegen: SectionCodegen }),
) {
  try {
    await patchSectionCodegen(job.projectId, job.sectionId, (state) => {
      if (state.codegen?.runId !== job.runId) return undefined;
      const next = update(state.codegen, state);
      const fields = "runId" in next ? { codegen: next } : next;
      // Progress is only shown live, never saved.
      return { ...fields, codegen: { ...fields.codegen, progress: undefined } };
    });
  } catch (error) {
    console.error(`Couldn't save the code generation status of ${job.key}:`, error);
  }
}

async function runJob(job: Job, previous: Promise<void>) {
  const { signal } = job.controller;
  await Promise.race([previous, whenAborted(signal)]);
  if (signal.aborted) {
    await save(job, (current) => ({ ...current, status: "cancelled", finishedAt: now(), error: job.cancelReason }));
    return;
  }

  const target = await findCodegenTarget(job.projectId, job.sectionId);
  const section = target?.section;
  // Gone, or replaced while it waited (the replacement has its own job).
  if (!target || !section || section.codegen?.runId !== job.runId || section.lineDiagram?.storedName !== section.codegen.lineDiagram) {
    return;
  }

  let journal: FileJournal | undefined;
  let costUsd: number | undefined;
  try {
    const mode = await nextMode(target.shipDir);
    await save(job, (current) => ({ ...current, status: "running", mode, startedAt: now() }));
    const policy = await CodegenPolicy.open(target.shipDir, section.dir);
    journal = new FileJournal(policy);

    setProgress(job, "Type-checking the project");
    const baseline = await typecheck(target.shipDir);
    signal.throwIfAborted();

    const values = await promptValues(target);
    const [system, prompt] = await Promise.all([renderPrompt("rules", values), renderPrompt(mode, values)]);
    const outcome = await runAgent({
      system,
      prompt,
      image: await readImage(section.dir, section.lineDiagram.storedName),
      policy,
      journal,
      controller: job.controller,
      typecheck: async () => typecheckReport(await typecheck(target.shipDir), baseline),
      onProgress: (step) => setProgress(job, step),
    });
    costUsd = outcome.costUsd;
    signal.throwIfAborted();

    setProgress(job, "Checking the generated code");
    const missing: string[] = [];
    for (const name of [CODEGEN_ENTRY_2D, CODEGEN_ENTRY_3D]) {
      if (!(await isFile(path.join(section.dir, name)))) missing.push(name);
    }
    if (missing.length) throw new Error(`The agent didn't create ${missing.join(" or ")}.`);
    const fresh = newDiagnostics(baseline, await typecheck(target.shipDir));
    if (fresh.length) throw new Error(`The generated code has type errors, so it was rolled back:\n${formatDiagnostics(fresh.slice(0, 5))}`);

    const files = await journal.changedFiles();
    const finishedAt = now();
    // The section's versions only change in its own jobs, which run one at a time, so the number can't be taken.
    const version = Math.max(0, ...section.versions.map((entry) => entry.version)) + 1;
    const entry: CodegenVersion = {
      version,
      finishedAt,
      mode,
      lineDiagramName: section.lineDiagram.name,
      files: await keepVersion(target.shipDir, section.id, section.dir, version),
      costUsd,
    };
    await recordGeneration(target.shipDir, { sectionId: section.id, section: section.name, version, mode, finishedAt, files });
    const summary = outcome.summary.trim().slice(0, SUMMARY_MAX);
    await save(job, (current, state) => ({
      codegen: { ...current, status: "done", finishedAt, files, summary, costUsd, version, error: undefined },
      versions: [...state.versions.filter((other) => other.version !== version), entry],
      activeVersion: version,
    }));
  } catch (error) {
    if (error instanceof AgentError) costUsd = error.costUsd ?? costUsd;
    const cancelled = signal.aborted;
    let message = cancelled ? (job.cancelReason ?? "Stopped.") : error instanceof Error ? error.message : String(error);
    if (!cancelled) console.warn(`Code generation for ${job.key} failed:`, error);
    try {
      // The SDK reports a stop as soon as it's asked to, so let a write the agent had already started land first.
      if (journal) await new Promise((resolve) => setTimeout(resolve, ROLLBACK_DELAY_MS));
      await journal?.restore();
    } catch (restoreError) {
      console.error(`Couldn't roll back all files of the code generation for ${job.key}:`, restoreError);
      message += " Some of the files it wrote couldn't be rolled back; the server log lists them.";
    }
    await save(job, (current) => ({
      ...current,
      status: cancelled ? "cancelled" : "failed",
      finishedAt: now(),
      error: message,
      costUsd,
    }));
  }
}

async function isFile(file: string): Promise<boolean> {
  return fs.stat(file).then((stat) => stat.isFile(), () => false);
}

/** The drawing as an image for the prompt, or undefined for an SVG, which the agent reads as text instead. */
async function readImage(sectionDir: string, storedName: string) {
  const mediaType = IMAGE_TYPES[getExtension(storedName)];
  if (!mediaType) return undefined;
  return { mediaType, data: (await fs.readFile(path.join(sectionDir, storedName))).toString("base64") };
}

async function promptValues(target: CodegenTarget): Promise<PromptValues> {
  const { section, shipDir } = target;
  const folderOf = (dir: string) => path.relative(shipDir, dir).split(path.sep).join("/");
  const sectionDir = folderOf(section.dir);
  const imagePath = `${sectionDir}/${section.lineDiagram?.storedName}`;
  const generated: string[] = [];
  for (const other of target.sections) {
    if (other.id !== section.id && (await isFile(path.join(other.dir, CODEGEN_ENTRY_2D)))) {
      generated.push(`"${other.name}" (\`${folderOf(other.dir)}/\`)`);
    }
  }
  return {
    shipName: target.shipName,
    sectionName: section.name,
    sectionId: section.id,
    sectionDir,
    drawing: IMAGE_TYPES[getExtension(imagePath)]
      ? `attached to this message (it's also saved as \`${imagePath}\`)`
      : `an SVG file, \`${imagePath}\`: read it with the Read tool`,
    generatedSections: generated.length ? generated.join(", ") : "none at the moment",
    previousCode: (await isFile(path.join(section.dir, CODEGEN_ENTRY_2D)))
      ? "This section already has generated code, made from an earlier drawing: replace it to match this one."
      : "",
  };
}

/** A finished generation, as listed in the ship's codegen/generations.json. */
interface Generation {
  sectionId: string;
  section: string;
  /** The section's version it created. */
  version: number;
  mode: CodegenMode;
  finishedAt: string;
  /** Every file it created or changed, relative to the ship's folder. */
  files: string[];
}

function stateFile(shipDir: string) {
  return path.join(shipDir, ...CODEGEN_STATE_FILE.split("/"));
}

async function readGenerations(shipDir: string): Promise<Generation[]> {
  const file = stateFile(shipDir);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return [];
    throw error;
  }
  try {
    const { generations } = JSON.parse(text);
    if (!Array.isArray(generations)) throw new Error("it has no generations list");
    return generations;
  } catch (error) {
    // Guessing "first" could overwrite the ship's shared components, so the generation fails instead.
    throw new Error(`The ship's ${CODEGEN_STATE_FILE} can't be read (${error instanceof Error ? error.message : error}). Fix or delete it.`);
  }
}

/** The prompt for the ship's next generation: "first" until one has finished, then "second". */
async function nextMode(shipDir: string): Promise<CodegenMode> {
  return (await readGenerations(shipDir)).length ? "second" : "first";
}

/** Only one job per ship runs at a time, so this read-and-write can't race another. */
async function recordGeneration(shipDir: string, generation: Generation) {
  const generations = [...(await readGenerations(shipDir)), generation].slice(-STATE_MAX);
  const file = stateFile(shipDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await writeAtomic(file, `${JSON.stringify({ generations }, null, 2)}\n`);
}

function versionDir(shipDir: string, sectionId: string, version: number) {
  return path.join(shipDir, ...codegenVersionDir(sectionId, version).split("/"));
}

/**
 * Copies the section's generated files to codegen/<section ID>/v<version>/, replacing anything left there (e.g. by a
 * generation that failed after copying). Returns the files, relative to the section's folder.
 */
async function keepVersion(shipDir: string, sectionId: string, sectionDir: string, version: number): Promise<string[]> {
  const dir = versionDir(shipDir, sectionId, version);
  const files = await listGeneratedFiles(sectionDir);
  await fs.rm(dir, { recursive: true, force: true });
  for (const file of files) {
    const target = path.join(dir, ...file.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(sectionDir, ...file.split("/")), target);
  }
  return files;
}

/**
 * Switches a section's code to one of its versions: its generated files are replaced by that version's, and the
 * ship must still type-check, or everything is put back and an ApiError (409) says why. Only the section's own files
 * change: the shared components stay as they are, since the ship's other sections use them. Hand edits to the
 * section's generated files are replaced too. Refused while the ship's code is being generated or restored.
 */
export async function restoreCodegenVersion(projectId: string, sectionId: string, version: number) {
  const key = jobKey(projectId, sectionId);
  if (runtime.queues.has(projectId)) {
    throw new ApiError(409, "This ship's code is being generated or restored. Try again once that's finished.");
  }
  const work = restoreVersion(projectId, sectionId, version);
  // Takes the ship's turn, so a generation started meanwhile waits until the files are in place.
  const settled = work.then(
    () => undefined,
    () => undefined,
  );
  runtime.restores.set(key, settled);
  const tail: Promise<void> = settled.then(() => {
    if (runtime.queues.get(projectId) === tail) runtime.queues.delete(projectId);
    if (runtime.restores.get(key) === settled) runtime.restores.delete(key);
  });
  runtime.queues.set(projectId, tail);
  return work;
}

async function restoreVersion(projectId: string, sectionId: string, version: number) {
  const target = await findCodegenTarget(projectId, sectionId);
  if (!target) throw new ApiError(404, `${sectionId} no longer exists.`);
  const { section, shipDir } = target;
  const entry = section.versions.find((other) => other.version === version);
  if (!entry) throw new ApiError(404, `${sectionId} has no version ${version}.`);
  if (section.activeVersion === version) return;
  const dir = versionDir(shipDir, sectionId, version);
  for (const file of entry.files) {
    if (!(await isFile(path.join(dir, ...file.split("/"))))) {
      throw new ApiError(409, `Version ${version}'s files are missing from child/ships/${path.basename(shipDir)}/${codegenVersionDir(sectionId, version)}/.`);
    }
  }

  const policy = await CodegenPolicy.open(shipDir, section.dir);
  const journal = new FileJournal(policy);
  const baseline = await typecheck(shipDir);
  try {
    for (const file of await listGeneratedFiles(section.dir)) {
      const checked = await policy.checkWrite(path.join(section.dir, ...file.split("/")));
      if ("target" in checked) await journal.remove(checked.target);
    }
    for (const file of entry.files) {
      // The same rules as the agent's writes, in case the kept files were changed by hand.
      const checked = await policy.checkWrite(path.join(section.dir, ...file.split("/")));
      if ("refused" in checked) throw new ApiError(409, `Version ${version} has a file that can't be restored (${file}): ${checked.refused}`);
      await journal.remember(checked.target);
      await fs.mkdir(path.dirname(checked.target), { recursive: true });
      await fs.copyFile(path.join(dir, ...file.split("/")), checked.target);
    }
    const fresh = newDiagnostics(baseline, await typecheck(shipDir));
    if (fresh.length) {
      throw new ApiError(
        409,
        `Version ${version} doesn't type-check with the ship's current shared components, so it wasn't restored:\n${formatDiagnostics(fresh.slice(0, 5))}`,
      );
    }
  } catch (error) {
    await journal.restore();
    throw error;
  }
  await patchSectionCodegen(projectId, sectionId, () => ({ activeVersion: version }));
}
