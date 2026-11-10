import fs from "node:fs/promises";
import path from "node:path";
import { OBJECT_CARD_FILE } from "@/lib/codegen";
import { COLLECTIONS } from "@/lib/collection-defs";
import { fileKindFromExtension, getExtension } from "@/lib/files";
import { CHILD_DIR, errorCode, writeAtomic } from "@/server/child-dir";
import type { CodegenObject } from "@/server/storage";
import type { CodegenObjects } from "@/types/records";
import { IMAGE_MEDIA_TYPES, type AgentImage } from "./agent";
import { assertPlainPath, type CodegenPolicy, type FileJournal } from "./policy";
import { dataBlock, quoteText } from "./untrusted";

/**
 * The section's objects (picked in the Library) in a generation. The agent looks at an object's image only the first
 * time a generation uses it, and writes the object's card: card.json in the object's folder, with its kind, what it
 * looks like, its aspect ratio and its connection points. Every later generation, for any section of the ship, gets
 * the card as text instead of the image, which saves the image's tokens on every request of the run. The generated
 * code draws objects with the viewer's ObjectSymbol2D and ObjectModel3D (child/template/src/objects/), which show the
 * object's image and 3D model at runtime, so the agent never needs the files themselves.
 *
 * A card belongs to one image: its `image` is that file's stored name, which changes with every upload. Replacing an
 * object's image in the Library makes its card stale, and the next generation that uses the object looks at it again.
 *
 * Each of the section's objects is, in a generation:
 *   known    it has a card for its current image: the card goes in the prompt, and its files can't be read
 *   attach   new, with a PNG, JPEG or WEBP image: the image is sent with the task, and the agent writes the card
 *   read     new, with an SVG image: the agent reads that one file as text (before it writes anything), and writes the card
 *   skip     new, but not looked at this time (too many new objects, images too big): placed from its name
 * The agent may write only the cards of the objects it's shown (policy.ts). When it's done, each of those cards is
 * checked and saved with the image's stored name and its real aspect ratio; one that's missing or wrong is left out,
 * so the object is looked at again next time. A card never fails a generation.
 */

/** The most objects a generation looks at for the first time; more wait for a later one, to keep a run's size and cost bounded. */
const MAX_NEW_OBJECTS = 12;
/** The most bytes of new objects' images sent with one task (they're part of every request of the run). */
const MAX_ATTACHED_BYTES = 8 * 1024 * 1024;
/** The biggest SVG image the agent reads as text. */
const MAX_SVG_BYTES = 100 * 1024;
/** The viewer's object components the prompts rely on, in the ship's objects folder. Ships made before them don't have them. */
const VIEWER_FILES = ["card.ts", "ObjectSymbol2D.tsx", "ObjectModel3D.tsx"];

const KIND_MAX = 60;
const DESCRIPTION_MAX = 400;
const MAX_PORTS = 12;
const PORT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,23}$/;

export interface ObjectCardPort {
  id: string;
  /** Fractions of the image: from the left edge and from the top, 0 to 1. */
  x: number;
  y: number;
}

/** An object's card.json, as the viewer reads it (child/template/src/objects/card.ts). */
export interface ObjectCard {
  /** Stored name of the 2D image it was made from, e.g. "fuel-pump-2d-9f2c1a7b.png" (or "lineDiagram-9f2c1a7b.png" for older objects). */
  image: string;
  kind: string;
  description: string;
  /** Width ÷ height of the image. */
  aspect: number;
  ports: ObjectCardPort[];
}

type CardContent = Omit<ObjectCard, "image">;

type Treatment = "known" | "attach" | "read" | "skip";

interface PlannedObject {
  object: CodegenObject;
  /** The object's folder in the stage. */
  dir: string;
  /** Its image in the stage. */
  image: string;
  /** The image's width ÷ height, from the file, or from its card; null if neither says. */
  aspect: number | null;
  how: Treatment;
  /** known: its card. */
  card?: ObjectCard;
  /** attach: the image sent with the task. */
  attachment?: AgentImage;
  /** skip: why it isn't looked at. */
  reason?: string;
}

export interface ObjectPlan {
  /** Whether the ship's viewer has the object components. Without them, objects are drawn like other equipment. */
  supported: boolean;
  objects: PlannedObject[];
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isFraction(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

async function isFile(file: string): Promise<boolean> {
  return fs.stat(file).then((stat) => stat.isFile(), () => false);
}

/** A card's content as the agent wrote it, checked, or what's wrong with it. The `image` it may hold is ignored. */
function checkCard(value: unknown): { card: CardContent } | { problem: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { problem: "it isn't a JSON object" };
  const raw = value as Record<string, unknown>;
  const kind = typeof raw.kind === "string" ? raw.kind.trim() : "";
  if (!kind || kind.length > KIND_MAX) return { problem: `"kind" must be a short text, at most ${KIND_MAX} characters` };
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (!description || description.length > DESCRIPTION_MAX) {
    return { problem: `"description" must be a sentence or two, at most ${DESCRIPTION_MAX} characters` };
  }
  const { aspect } = raw;
  if (typeof aspect !== "number" || !Number.isFinite(aspect) || aspect < 0.05 || aspect > 20) {
    return { problem: `"aspect" must be the image's width divided by its height, a number from 0.05 to 20` };
  }
  if (!Array.isArray(raw.ports) || raw.ports.length > MAX_PORTS) {
    return { problem: `"ports" must be a list of at most ${MAX_PORTS} connection points` };
  }
  const ports: ObjectCardPort[] = [];
  for (const [index, entry] of (raw.ports as unknown[]).entries()) {
    const port = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    if (typeof port.id !== "string" || !PORT_ID.test(port.id) || ports.some((other) => other.id === port.id)) {
      return { problem: `ports[${index}].id must be a unique short name such as "in" or "out" (letters, digits, "_" and "-")` };
    }
    if (!isFraction(port.x) || !isFraction(port.y)) return { problem: `ports[${index}] needs "x" and "y", each from 0 to 1` };
    ports.push({ id: port.id, x: round(port.x), y: round(port.y) });
  }
  return { card: { kind, description, aspect: round(aspect), ports } };
}

/** A card file, checked: null if there's none, else its content or what's wrong with it. */
async function readCardFile(file: string): Promise<{ card: CardContent; image: unknown } | { problem: string } | null> {
  await assertPlainPath(CHILD_DIR, file);
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes(errorCode(error) ?? "")) return null;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { problem: "it isn't valid JSON" };
  }
  const checked = checkCard(value);
  return "card" in checked ? { card: checked.card, image: (value as { image?: unknown }).image } : checked;
}

/**
 * An image's size in pixels, from its header: PNG, JPEG, WEBP, or an SVG's viewBox (or width and height). Null if it
 * can't be told.
 */
export function imageSize(bytes: Buffer, extension: string): { width: number; height: number } | null {
  const size = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null);
  if (extension === "png") {
    if (bytes.length < 24 || bytes.readUInt32BE(0) !== 0x89504e47) return null;
    return size(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  if (extension === "jpg" || extension === "jpeg") {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xff) {
        at += 1;
        continue;
      }
      // Start of frame (baseline, progressive…), but not DHT (C4), JPG (C8) or DAC (CC): its height, then width.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return size(bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5));
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
    return null;
  }
  if (extension === "webp") {
    if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8 ") return size(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
    if (chunk === "VP8L") {
      const [b0, b1, b2, b3] = [bytes[21], bytes[22], bytes[23], bytes[24]];
      return size(1 + (((b1 & 0x3f) << 8) | b0), 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
    }
    if (chunk === "VP8X") return size(1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3));
    return null;
  }
  if (extension === "svg") {
    const tag = /<svg\b[^>]*>/i.exec(bytes.toString("utf8"))?.[0];
    if (!tag) return null;
    const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
    const box = attribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
    if (box?.length === 4 && box.every(Number.isFinite)) return size(box[2], box[3]);
    const length = (value: string | undefined) => (value && /^\s*[\d.]+\s*(px)?\s*$/i.test(value) ? parseFloat(value) : 0);
    return size(length(attribute("width")), length(attribute("height")));
  }
  return null;
}

/**
 * Decides how each of the section's objects is used (see the top of this file). `shipDir` is the real ship, whose
 * objects `objects` lists; `stageShip` is the stage's copy, where everything is read and the cards are written.
 */
export async function planObjects(objects: CodegenObject[], shipDir: string, stageShip: string): Promise<ObjectPlan> {
  const objectsDir = path.join(stageShip, ...COLLECTIONS.objects.dir.split("/"));
  const supported = (await Promise.all(VIEWER_FILES.map((name) => isFile(path.join(objectsDir, name))))).every(Boolean);
  const planned: PlannedObject[] = [];
  let looked = 0;
  let attachedBytes = 0;
  for (const object of objects) {
    const dir = path.join(stageShip, path.relative(shipDir, object.dir));
    const image = path.join(dir, object.lineDiagram.storedName);
    await assertPlainPath(CHILD_DIR, image);
    const skip = (reason: string, aspect: number | null = null) => planned.push({ object, dir, image, aspect, how: "skip", reason });
    if (!supported) {
      skip("this ship's viewer has no object components");
      continue;
    }

    const existing = await readCardFile(path.join(dir, OBJECT_CARD_FILE));
    if (existing && "card" in existing && existing.image === object.lineDiagram.storedName) {
      const card = { image: object.lineDiagram.storedName, ...existing.card };
      planned.push({ object, dir, image, aspect: card.aspect, how: "known", card });
      continue;
    }
    if (looked >= MAX_NEW_OBJECTS) {
      skip(`more than ${MAX_NEW_OBJECTS} of the section's objects are new, so this one is looked at in a later generation`);
      continue;
    }

    const extension = getExtension(object.lineDiagram.storedName);
    const bytes = await fs.readFile(image);
    const measured = imageSize(bytes, extension);
    const aspect = measured ? round(measured.width / measured.height) : null;
    const mediaType = IMAGE_MEDIA_TYPES[extension];
    if (mediaType) {
      if (attachedBytes + bytes.length > MAX_ATTACHED_BYTES) {
        skip("the new objects' images are too big to send together, so this one is looked at in a later generation", aspect);
        continue;
      }
      attachedBytes += bytes.length;
      looked += 1;
      const caption =
        `The 2D image of the object ${object.id} (${quoteText(object.name)}), \`${object.lineDiagram.storedName}\`, from ` +
        "the Library: the symbol ObjectSymbol2D draws, which its card describes (not its 3D diagram):";
      planned.push({ object, dir, image, aspect, how: "attach", attachment: { caption, mediaType, data: bytes.toString("base64") } });
    } else if (extension === "svg" && bytes.length <= MAX_SVG_BYTES) {
      looked += 1;
      planned.push({ object, dir, image, aspect, how: "read" });
    } else {
      skip(extension === "svg" ? "its SVG image is too big to read" : "its image's format can't be shown", aspect);
    }
  }
  return { supported, objects: planned };
}

function looksAt(planned: PlannedObject): boolean {
  return planned.how === "attach" || planned.how === "read";
}

/** The new objects' images to send with the task. */
export function objectImages(plan: ObjectPlan): AgentImage[] {
  return plan.objects.flatMap((planned) => (planned.attachment ? [planned.attachment] : []));
}

/** For policy.allowObjects: the cards the agent may write, and the images it may read. */
export function objectAccess(plan: ObjectPlan): { cardDirs: string[]; readable: string[] } {
  return {
    cardDirs: plan.objects.filter(looksAt).map((planned) => planned.dir),
    readable: plan.objects.filter((planned) => planned.how === "read").map((planned) => planned.image),
  };
}

/** The images the agent must read before it writes anything (AgentRequest.readFirst), as it sees them. */
export function objectReads(plan: ObjectPlan, policy: CodegenPolicy): string[] {
  return plan.objects.filter((planned) => planned.how === "read").map((planned) => policy.label(planned.image));
}

/** What an object's 3D diagram is, for the prompt. */
function modelFormat(object: CodegenObject): string {
  const extension = getExtension(object.model.storedName);
  // For now an image may be uploaded in place of a 3D model; ObjectModel3D shows it as a flat picture.
  if (fileKindFromExtension(extension) === "image") return `a ${extension.toUpperCase()} image standing in for a 3D model`;
  return extension ? `a ${extension.toUpperCase()} model` : "no model";
}

/**
 * An object's two files, by the view each is for (see VIEW_FILE_NAME in src/lib/files.ts), so the agent never takes
 * one for the other, even when both are images. Stored names are made by storage.ts from letters, digits and "-" only.
 */
function objectFiles(object: CodegenObject): string {
  return (
    `2D image \`${object.lineDiagram.storedName}\`; ` +
    `3D diagram \`${object.model.storedName}\`, ${modelFormat(object)}`
  );
}

function point(port: ObjectCardPort): string {
  return `${port.id} (${port.x}, ${port.y})`;
}

/** The {{objects}} placeholder: the section's objects, and what to do with each. */
export function objectsPrompt(plan: ObjectPlan, policy: CodegenPolicy): string {
  if (plan.objects.length === 0) return "This section uses no objects from the Library.";
  const name = ({ object }: PlannedObject) => `${object.id} ${quoteText(object.name)} (${objectFiles(object)})`;
  if (!plan.supported) {
    return (
      "This section uses these objects from the Library, but this ship's viewer has no object components " +
      "(`src/objects/ObjectSymbol2D.tsx` and `src/objects/ObjectModel3D.tsx`), so draw them like the drawing's other " +
      `equipment, and write no cards: ${plan.objects.map(name).join(", ")}.`
    );
  }

  const parts: string[] = [];
  const known = plan.objects.filter((planned) => planned.how === "known");
  if (known.length) {
    const lines = known.map((planned) => {
      const card = planned.card!;
      const ports = card.ports.length ? card.ports.map(point).join(", ") : "none";
      return (
        `${name(planned)}: ${quoteText(card.kind)}; aspect ${card.aspect}; connection points: ${ports}\n` +
        `  looks like: ${quoteText(card.description, DESCRIPTION_MAX)}`
      );
    });
    parts.push(
      "Objects you know from their cards, written when a section of this ship first used them (their images aren't sent " +
        `again, and can't be read):\n\n${dataBlock(lines.join("\n"))}`,
    );
  }

  const fresh = plan.objects.filter(looksAt);
  if (fresh.length) {
    const lines = fresh.map((planned) => {
      const card = `\`${policy.label(path.join(planned.dir, OBJECT_CARD_FILE))}\``;
      const where =
        planned.how === "attach"
          ? "its 2D image is attached to this message"
          : `its 2D image is an SVG, \`${policy.label(planned.image)}\`: read it with the Read tool before you write anything`;
      const aspect = planned.aspect ? ` Its 2D image's aspect (width ÷ height) is ${planned.aspect}.` : "";
      return `- ${name(planned)}: ${where}. Write its card, ${card}.${aspect}`;
    });
    parts.push(
      "Objects new to this ship's code. Look at each one's 2D image, and write its card (see \"Objects from the Library\" in " +
        `your rules), so later generations can place it without the image:\n\n${lines.join("\n")}`,
    );
  }

  const skipped = plan.objects.filter((planned) => planned.how === "skip");
  if (skipped.length) {
    const lines = skipped.map((planned) => `- ${name(planned)}: ${planned.reason}.`);
    parts.push(
      "Objects not looked at in this generation. Draw each with ObjectSymbol2D and ObjectModel3D anyway, in a box shaped " +
        `as the drawing shows it, with pipes to the middle of the box's sides, and write no card:\n\n${lines.join("\n")}`,
    );
  }
  return parts.join("\n\n");
}

/**
 * What's wrong with the cards the agent was asked to write (missing, or not as described), for it to fix, or null.
 * Only cards written in this run count: an object's earlier card was made from another image.
 */
export async function checkCards(plan: ObjectPlan, journal: FileJournal, policy: CodegenPolicy): Promise<string | null> {
  const problems: string[] = [];
  for (const planned of plan.objects.filter(looksAt)) {
    const file = path.join(planned.dir, OBJECT_CARD_FILE);
    const label = `\`${policy.label(file)}\``;
    const checked = journal.hasFilesIn(planned.dir) ? await readCardFile(file) : null;
    if (!checked) problems.push(`- ${label} hasn't been written (the card of ${planned.object.id}).`);
    else if ("problem" in checked) problems.push(`- ${label}: ${checked.problem}.`);
  }
  return problems.length ? problems.join("\n") : null;
}

/**
 * Once the agent is done: saves each card it was asked to write, with the image's stored name and, when the file
 * tells, its real aspect ratio. A card that's missing or wrong is left out (put back as it was), so the object is
 * looked at again next time. Returns how each object was used.
 */
export async function settleCards(plan: ObjectPlan, journal: FileJournal): Promise<CodegenObjects> {
  const used: CodegenObjects = { learned: [], reused: [], skipped: [] };
  for (const planned of plan.objects) {
    const { id } = planned.object;
    if (planned.how === "known") {
      used.reused.push(id);
      continue;
    }
    if (planned.how === "skip") {
      used.skipped.push(id);
      continue;
    }
    const file = path.join(planned.dir, OBJECT_CARD_FILE);
    const checked = journal.hasFilesIn(planned.dir) ? await readCardFile(file) : null;
    if (checked && "card" in checked) {
      const card: ObjectCard = {
        image: planned.object.lineDiagram.storedName,
        ...checked.card,
        aspect: planned.aspect ?? checked.card.aspect,
      };
      await journal.remember(file);
      await assertPlainPath(CHILD_DIR, file);
      await writeAtomic(file, `${JSON.stringify(card, null, 2)}\n`);
      used.learned.push(id);
    } else {
      await journal.restoreIn(planned.dir);
      used.skipped.push(id);
    }
  }
  return used;
}
