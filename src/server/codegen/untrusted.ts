/**
 * Text that isn't ours, on its way into what the agent reads: names typed in the Library, file names in a project's
 * tree, and type checker messages (which quote the code they're about). Only the system prompt (rules.md) and the
 * generation prompt (first.md or second.md) are instructions; this text is marked as data so it can't pass for them
 * (see rules.md, "Untrusted content"):
 *   quoteText   one line, as a JSON string, for names;
 *   dataBlock   a fenced block labelled `data`, whose fence is longer than any run of backticks inside it, so the text
 *               can't close it early and carry on as if it were the prompt.
 * Both drop control and bidirectional-override characters, which could hide or reorder text.
 */

/** Control characters, and invisible ones that change how text reads: direction marks and overrides, line and paragraph separators. Tab and newline stay. */
const HIDDEN_RANGES: [number, number][] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x7f],
  [0x200e, 0x200f],
  [0x2028, 0x202e],
  [0x2066, 0x2069],
];
// Built from the codes, so the source holds no invisible characters (none of the ranges needs escaping in a class).
const HIDDEN_CHARACTERS = new RegExp(
  `[${HIDDEN_RANGES.map(([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`).join("")}]`,
  "g",
);

export function cleanText(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(HIDDEN_CHARACTERS, "");
}

/** A name as one line of JSON, e.g. "Engine Room" with its quotes, cut to `max` characters. */
export function quoteText(text: string, max = 200): string {
  const line = cleanText(text).replace(/\s+/g, " ").trim();
  return JSON.stringify(line.length > max ? `${line.slice(0, max)}…` : line);
}

/** Text as a fenced block labelled `data`. */
export function dataBlock(text: string): string {
  const clean = cleanText(text);
  const longest = Math.max(2, ...[...clean.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  return `${fence}data\n${clean}\n${fence}`;
}
