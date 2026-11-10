import fs from "node:fs/promises";
import path from "node:path";

/**
 * The code generation prompts, in ./prompts as Markdown so they're easy to edit. They're read again for each
 * generation, so an edit applies to the next one without a restart.
 *   rules.md    appended to Claude Code's system prompt, for every generation
 *   first.md    the task for a ship's first generation
 *   second.md   the task for every later generation of the ship
 * These are the only instructions the agent gets (besides Claude Code's own system prompt): only these three names
 * can be read, and each must be a regular file in ./prompts, not a link. A leading <!-- comment --> is left out, and
 * {{name}} placeholders are filled in (see PromptValues), each value at most once, so a value can't bring in another.
 */
const PROMPTS_DIR = path.join(process.cwd(), "src", "server", "codegen", "prompts");

export type PromptName = "rules" | "first" | "second";
const PROMPT_NAMES: readonly PromptName[] = ["rules", "first", "second"];

/**
 * The values filled in. Text that came from people (names typed in the Library, file names) arrives already quoted or
 * fenced as data (see untrusted.ts); the rest is made by the job.
 */
export interface PromptValues {
  /** Quoted, e.g. "MV Aurora" with its quotes. */
  shipName: string;
  /** Quoted. */
  sectionName: string;
  sectionId: string;
  /** The section's folder, relative to the ship's, e.g. "src/sections/engine-room". */
  sectionDir: string;
  /** Where the drawing is, e.g. "attached to this message (it's also saved as `…`)". */
  drawing: string;
  /** The other sections that already have generated code (names quoted), for the second prompt. */
  generatedSections: string;
  /** A note when the section already has generated code from an earlier drawing, else empty. */
  previousCode: string;
  /** The ship's project folder as an indented file tree, fenced as data (see structure.ts). */
  projectTree: string;
  /** The shared viewer's folder (child/core, @shipdocs/viewer-core), read-only, absolute, with forward slashes. */
  coreDir: string;
  /** The shared viewer's folder as an indented file tree, fenced as data. */
  coreTree: string;
  /** child/, absolute, with forward slashes: where the other ships are, to read. */
  childDir: string;
  /**
   * The section's objects from the Library: those known from their cards (as text), those new to the ship's code
   * (whose images are sent, for the agent to write their cards), and those not looked at (see objects.ts).
   */
  objects: string;
}

export async function renderPrompt(name: PromptName, values: PromptValues): Promise<string> {
  if (!PROMPT_NAMES.includes(name)) throw new Error(`There's no prompt named ${name}.`);
  const file = path.join(PROMPTS_DIR, `${name}.md`);
  const stat = await fs.lstat(file).catch(() => null);
  if (!stat?.isFile()) throw new Error(`The prompt file src/server/codegen/prompts/${name}.md is missing, or isn't a regular file.`);
  const template = await fs.readFile(file, "utf8");
  return template
    .replace(/^﻿?\s*<!--[\s\S]*?-->\s*/, "")
    .replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
      if (!Object.hasOwn(values, key)) {
        const known = Object.keys(values).map((k) => `{{${k}}}`).join(", ");
        throw new Error(`Unknown placeholder ${placeholder} in prompts/${name}.md. The placeholders are ${known}.`);
      }
      return values[key as keyof PromptValues];
    })
    .trim();
}
