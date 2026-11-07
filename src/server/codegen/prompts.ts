import fs from "node:fs/promises";
import path from "node:path";

/**
 * The code generation prompts, in ./prompts as Markdown so they're easy to edit. They're read again for each
 * generation, so an edit applies to the next one without a restart.
 *   rules.md    appended to Claude Code's system prompt, for every generation
 *   first.md    the task for a ship's first generation
 *   second.md   the task for every later generation of the ship
 * A leading <!-- comment --> is left out, and {{name}} placeholders are filled in (see PromptValues).
 */
const PROMPTS_DIR = path.join(process.cwd(), "src", "server", "codegen", "prompts");

export type PromptName = "rules" | "first" | "second";

export interface PromptValues {
  shipName: string;
  sectionName: string;
  sectionId: string;
  /** The section's folder, relative to the ship's, e.g. "src/sections/engine-room". */
  sectionDir: string;
  /** Where the drawing is, e.g. "attached to this message (it's also saved as `…`)". */
  drawing: string;
  /** The other sections that already have generated code, for the second prompt. */
  generatedSections: string;
  /** A note when the section already has generated code from an earlier drawing, else empty. */
  previousCode: string;
}

export async function renderPrompt(name: PromptName, values: PromptValues): Promise<string> {
  const file = path.join(PROMPTS_DIR, `${name}.md`);
  const template = await fs.readFile(file, "utf8").catch((error) => {
    throw new Error(`The prompt file src/server/codegen/prompts/${name}.md couldn't be read: ${error.message}`);
  });
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
