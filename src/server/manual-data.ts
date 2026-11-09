import type { ManualData } from "@/types/records";

/**
 * Reads the component tables out of a section's manual (PDF), for its manual-data.json. Each table has two columns:
 * field names on the left ("id", "pressure_rating", "specs.material"…) and values on the right.
 *   - Where the value column starts is learned from each page's rows, so any column widths and page sizes work.
 *   - An "id" row starts a component. A later table with the same ID (e.g. continued on the next page) adds to it.
 *   - Dotted names become nested objects: "specs.material" is saved as { specs: { material } }.
 *   - A row with only a value continues the previous field's text, e.g. a description wrapped onto a second line. It
 *     has to be right below the line before it on the same page, so page numbers and footers aren't added. A line in
 *     capitals is taken for a heading and skipped, unless the text it would continue is in capitals too.
 *   - Once the whole manual is read, values like "12", "true" and "null" or "none" become numbers, booleans and null.
 *     IDs, serial numbers and codes stay text (see ID_FIELD and CODE_FIELD), and so do numbers like "007".
 *   - Field names start with a lower-case letter, so other text (page headings, notes) is skipped. So is a component
 *     with nothing but an ID.
 */

/** Text whose baselines are closer than this fraction of its height is on the same row, even in a different font size. */
const ROW_TOLERANCE = 0.5;
/** Pieces of text further apart than this fraction of their height have a space between them. Closer ones are one word. */
const WORD_GAP = 0.15;
/** A gap this many times the text height after a field name is the space between the name and value columns. */
const COLUMN_GAP = 2;
/** Values can start this far, in PDF points, left of where most of them start. */
const COLUMN_SLACK = 3;
/** Until a page shows where its values start, they're taken to start at this fraction of the page width. */
const SPLIT_FRACTION = 0.45;
/** A line with only a value continues the field above it if it's at most this many line heights below that field's last line. */
const LINE_SPACING = 3;
/** "id", or a field name like "specs.max_pressure": each part starts with a lower-case letter. */
const FIELD_NAME = /^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)*$/;
/** Names that would reach Object.prototype if used as keys, so a PDF can't change it. */
const UNSAFE_NAMES = new Set(["__proto__", "constructor", "prototype"]);
/** Fields always kept as text: "id", and names ending in "_id", "_ids", "_number" or "_no", like "line_number". */
const ID_FIELD = /^id$|_(id|ids|number|no)$/;
/** Fields kept as text even when they look like numbers or booleans, like "fault_code", but that can be null. */
const CODE_FIELD = /(^|_)code$/;
/** A number as written in a table, without units. Not "007", which is a code. */
const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;
/** Characters that don't show, like soft hyphens and zero-width spaces. */
const INVISIBLE = /[­​-‍⁠﻿]/g;

/** A component as read, before its values are typed. */
interface Text {
  [name: string]: string | Text;
}
type Value = string | number | boolean | null | Fields;
interface Fields {
  [name: string]: Value;
}
export type ManualComponent = Fields & { id: string };

interface Word {
  text: string;
  x: number;
  /** Where the text ends on the right. */
  end: number;
  y: number;
  /** Font size. */
  size: number;
}

interface Row {
  /** Left to right. */
  words: Word[];
  /** The highest and lowest baselines on the row. */
  top: number;
  bottom: number;
  /** The largest font size on the row. */
  size: number;
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
  if (text === "" || ID_FIELD.test(field)) return text;
  const lower = text.toLowerCase();
  if (lower === "null" || lower === "none") return null;
  if (CODE_FIELD.test(field)) return text;
  if (lower === "true") return true;
  if (lower === "false") return false;
  // A number with too many digits to keep exactly, like a serial number, stays text.
  return NUMBER.test(text) && Math.abs(Number(text)) <= Number.MAX_SAFE_INTEGER ? Number(text) : text;
}

function toValues(text: Text): Fields {
  return Object.fromEntries(
    Object.entries(text).map(([name, value]) => [name, typeof value === "string" ? toValue(value, name) : toValues(value)]),
  );
}

/** The object that holds the last of `path`, e.g. component.specs for ["specs", "material"]. `create` adds missing ones. */
function parentOf(component: Text, path: string[], create: boolean): Text | undefined {
  let target = component;
  for (const part of path.slice(0, -1)) {
    const next = target[part];
    if (typeof next === "object") target = next;
    else if (create) target = target[part] = {};
    else return undefined;
  }
  return target;
}

/**
 * Adds a wrapped line to the end of a field's text, and says whether it did. A line in capitals is skipped as a
 * heading, unless the text is in capitals too. A word broken after its hyphen, like "self-" "closing", is joined up.
 */
function continueField(component: Text, path: string[], line: string): boolean {
  const parent = parentOf(component, path, false);
  const field = path[path.length - 1];
  const previous = parent?.[field];
  if (!parent || typeof previous !== "string") return false;
  const isCapitals = (text: string) => text === text.toUpperCase();
  if (isCapitals(line) && !(previous && isCapitals(previous))) return false;
  parent[field] = !previous ? line : /\p{L}-$/u.test(previous) ? previous + line : `${previous} ${line}`;
  return true;
}

/** Groups text into rows, top to bottom, each read left to right. */
function toRows(words: Word[]): Row[] {
  const rows: Row[] = [];
  // PDF y grows upwards. Sorted top down, a word is either on the last row or starts a new one.
  for (const word of [...words].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const last = rows.at(-1);
    if (last && last.top - word.y <= ROW_TOLERANCE * Math.min(last.size, word.size)) {
      last.words.push(word);
      last.bottom = word.y;
      last.size = Math.max(last.size, word.size);
    } else {
      rows.push({ words: [word], top: word.y, bottom: word.y, size: word.size });
    }
  }
  for (const row of rows) row.words.sort((a, b) => a.x - b.x);
  return rows;
}

/** The text of words on a row, left to right. PDFs often split a word into pieces, so only a gap makes a space. */
function joinWords(words: Word[]): string {
  let text = "";
  words.forEach((word, i) => {
    const previous = words[i - 1];
    if (previous && word.x - previous.end > WORD_GAP * Math.min(previous.size, word.size)) text += " ";
    text += word.text;
  });
  return text.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

/** A field name, which has no spaces even when the PDF splits it into pieces. */
function nameOf(words: Word[]): string {
  return joinWords(words).replace(/\s/g, "");
}

/**
 * Where the value column starts on a page, or undefined if no row shows it: the x most rows that start with a field
 * name have their value at, after a wide gap.
 */
function valueColumn(rows: Row[]): number | undefined {
  const counts = new Map<number, number>();
  for (const { words } of rows) {
    const at = words.findIndex((word, i) => i > 0 && word.x - words[i - 1].end > COLUMN_GAP * Math.min(word.size, words[i - 1].size));
    if (at < 1 || !fieldPath(nameOf(words.slice(0, at)))) continue;
    const x = Math.round(words[at].x);
    counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  let best: number | undefined;
  for (const [x, count] of counts) if (best === undefined || count > counts.get(best)!) best = x;
  return best;
}

/** The components in a manual, in the order they first appear. Throws if the PDF can't be opened. */
export async function extractComponents(pdfBytes: Uint8Array): Promise<ManualComponent[]> {
  // The legacy build is the one meant for Node. It's loaded on first use, so the rest of the API doesn't load PDF.js.
  const { getDocument, VerbosityLevel } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: pdfBytes, verbosity: VerbosityLevel.ERRORS });
  const components = new Map<string, Text & { id: string }>();
  let current: (Text & { id: string }) | undefined;
  /** The field being read, and the baseline of its last line on this page. */
  let lastPath: string[] | undefined;
  let lastLine: number | undefined;
  /** Where values start, carried over to pages that don't show it. */
  let valueX: number | undefined;
  try {
    const pdf = await task.promise;
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const [left, , right] = page.view;
      const words = (await page.getTextContent()).items.flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const [, , c, d, x, y] = item.transform;
        return [{ text: item.str, x, end: x + item.width, y, size: Math.hypot(c, d) }];
      });
      page.cleanup();

      const rows = toRows(words);
      valueX = valueColumn(rows) ?? valueX;
      const splitX = valueX === undefined ? left + (right - left) * SPLIT_FRACTION : valueX - COLUMN_SLACK;
      lastLine = undefined;

      for (const row of rows) {
        const name = nameOf(row.words.filter((word) => word.x < splitX));
        const value = joinWords(row.words.filter((word) => word.x >= splitX));
        if (!name && !value) continue;

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
          const isNextLine = lastLine !== undefined && lastLine - row.top <= LINE_SPACING * row.size;
          if (lastPath && isNextLine && continueField(current, lastPath, value)) lastLine = row.bottom;
          continue;
        }

        // Anything else on the left, like a note, ends the field before it, so its lines aren't added there.
        lastPath = fieldPath(name) ?? undefined;
        if (!lastPath) continue;
        // Empty values are kept, so every field in the table is in the JSON.
        parentOf(current, lastPath, true)![lastPath[lastPath.length - 1]] = value;
        lastLine = row.bottom;
      }
    }
  } finally {
    await task.destroy();
  }
  return [...components.values()]
    .filter((component) => Object.keys(component).length > 1)
    .map((component) => ({ ...toValues(component), id: component.id }));
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
