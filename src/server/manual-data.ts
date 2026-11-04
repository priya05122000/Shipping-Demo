import type { ManualData } from "@/types/records";

/**
 * Reads the component tables out of a section's manual (PDF), for its manual-data.json. Each table has two columns:
 * field names on the left ("id", "pressure_rating", "specs.material"…) and values on the right.
 *   - An "id" row starts a component. A later table with the same ID (e.g. continued on the next page) adds to it.
 *   - Dotted names become nested objects: "specs.material" is saved as { specs: { material } }.
 *   - A row with only a value continues the previous field's text, e.g. a description wrapped onto a second line.
 *   - Values like "12", "true" and "null" become numbers, booleans and null, except in ID-like fields.
 *   - Any other text (page headings, notes) is skipped.
 */

/** Text this close vertically, in PDF points, is on the same row. */
const ROW_TOLERANCE = 2.5;
/** Field names are left of this fraction of the page width, values right of it. */
const SPLIT_FRACTION = 0.45;
/** "id", or a field name like "specs.max_pressure". */
const FIELD_NAME = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)*$/;
/** Names that would reach Object.prototype if used as keys, so a PDF can't change it. */
const UNSAFE_NAMES = new Set(["__proto__", "constructor", "prototype"]);
/** Fields kept as text even when they look like numbers, e.g. "007". So are names ending in _id or _ids. */
const TEXT_FIELDS = new Set(["id", "fault_code", "line_number"]);

type Value = string | number | boolean | null | Fields;
interface Fields {
  [name: string]: Value;
}
export type ManualComponent = Fields & { id: string };

interface Word {
  text: string;
  x: number;
  y: number;
}

function isFields(value: Value | undefined): value is Fields {
  return typeof value === "object" && value !== null;
}

/** A field name's parts, e.g. ["specs", "material"], or null if the text isn't a field name. */
function fieldPath(name: string): string[] | null {
  if (!FIELD_NAME.test(name)) return null;
  const parts = name.split(".");
  // The ID can't hold nested fields.
  if ((parts[0] === "id" && parts.length > 1) || parts.some((part) => UNSAFE_NAMES.has(part))) return null;
  return parts;
}

function toValue(text: string, field: string): Value {
  if (text === "" || TEXT_FIELDS.has(field) || field.endsWith("_id") || field.endsWith("_ids")) return text;
  const lower = text.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  if (lower === "null") return null;
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
}

/** The object that holds the last of `path`, e.g. component.specs for ["specs", "material"]. `create` adds missing ones. */
function parentOf(component: Fields, path: string[], create: boolean): Fields | undefined {
  let target = component;
  for (const part of path.slice(0, -1)) {
    const next = target[part];
    if (isFields(next)) target = next;
    else if (create) target = target[part] = {};
    else return undefined;
  }
  return target;
}

/** Groups text into rows, top to bottom, each read left to right. */
function toRows(words: Word[]): Word[][] {
  const rows: { y: number; words: Word[] }[] = [];
  // PDF y grows upwards. Sorted top down, a word is either on the last row or starts a new one.
  for (const word of [...words].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = rows.at(-1);
    if (last && last.y - word.y <= ROW_TOLERANCE) last.words.push(word);
    else rows.push({ y: word.y, words: [word] });
  }
  return rows.map((row) => row.words.sort((a, b) => a.x - b.x));
}

/** The components in a manual, in the order they first appear. Throws if the PDF can't be opened. */
export async function extractComponents(pdfBytes: Uint8Array): Promise<ManualComponent[]> {
  // The legacy build is the one meant for Node. It's loaded on first use, so the rest of the API doesn't load PDF.js.
  const { getDocument, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: pdfBytes, verbosity: VerbosityLevel.ERRORS });
  const components = new Map<string, ManualComponent>();
  let current: ManualComponent | undefined;
  let lastPath: string[] | undefined;
  try {
    const pdf = await task.promise;
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const splitX = page.view[2] * SPLIT_FRACTION;
      const words = (await page.getTextContent()).items.flatMap((item) =>
        "str" in item && item.str.trim() ? [{ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }] : [],
      );
      page.cleanup();

      for (const row of toRows(words)) {
        const name = row
          .filter((word) => word.x < splitX)
          .map((word) => word.text)
          .join("")
          .replace(/\s+/g, "");
        const value = row
          .filter((word) => word.x >= splitX)
          .map((word) => word.text)
          .join(" ")
          .replace(/\s+/g, " ");

        if (name === "id") {
          if (value) {
            current = components.get(value) ?? { id: value };
            components.set(value, current);
            lastPath = undefined;
          }
          continue;
        }
        if (!current) continue;

        if (!name) {
          if (!lastPath) continue;
          const parent = parentOf(current, lastPath, false);
          const field = lastPath[lastPath.length - 1];
          const previous = parent?.[field];
          if (parent && typeof previous === "string") parent[field] = previous ? `${previous} ${value}` : value;
          continue;
        }

        const path = fieldPath(name);
        if (!path) continue;
        const field = path[path.length - 1];
        // Empty values are kept, so every field in the table is in the JSON.
        parentOf(current, path, true)![field] = toValue(value, field);
        lastPath = path;
      }
    }
  } finally {
    await task.destroy();
  }
  return [...components.values()];
}

/**
 * Reads a manual for manual-data.json: the file's text (null if there's nothing to write) and a summary for
 * section.json. Never throws: a manual that can't be read is still saved, without the file.
 */
export async function buildManualData(pdfBytes: Uint8Array): Promise<{ summary: ManualData; json: string | null }> {
  const extractedAt = new Date().toISOString();
  try {
    const components = await extractComponents(pdfBytes);
    if (components.length === 0) {
      const error = 'No component tables were found in the manual (a table starts with an "id" row).';
      return { summary: { components: 0, extractedAt, error }, json: null };
    }
    return { summary: { components: components.length, extractedAt }, json: `${JSON.stringify(components, null, 2)}\n` };
  } catch (error) {
    console.warn("Couldn't read the component tables in a manual:", error);
    const name = error instanceof Error ? error.name : "";
    const message =
      name === "PasswordException" ? "The manual is password-protected, so it couldn't be read." : "The manual couldn't be read as a PDF.";
    return { summary: { components: 0, extractedAt, error: message }, json: null };
  }
}
