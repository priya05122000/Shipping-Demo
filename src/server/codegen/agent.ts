import path from "node:path";
import type {
  EffortLevel,
  HookCallback,
  HookJSONOutput,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { CodegenLimit, CodegenUsage } from "@/types/records";
import { checkPattern, scanForLinks, toLabel, type CodegenPolicy, type FileJournal } from "./policy";
import { diagnosticsBlock, type Diagnostic } from "./typecheck";

/**
 * Runs the Claude Agent SDK (Claude Code as a library) in the stage's copy of a ship's project (staging.ts) to write
 * a section's React code.
 *
 * The agent gets only file tools (Read, Write, Edit, Glob, Grep) and a `typecheck` tool, so it can't run commands or
 * reach the web. Hooks keep it to the project, its rules and its errors:
 *   PreToolUse    every tool call is checked against the CodegenPolicy before it runs: the path it names (no "..",
 *                 inside child/, no links, writes only in the stage's ship and template, not protected files), the
 *                 tree a search reads, and, for typecheck, the stage. The checked absolute path replaces the one the
 *                 agent gave, so the tool uses exactly what was checked. Writes are refused until the agent has read
 *                 the files its code builds on (`readFirst`), and recorded in the journal before they're allowed.
 *   PostToolUse   after every tool call, the same path is checked again, and the stage scanned for links, in case
 *                 something changed in between (TOCTOU): then the tool's result is withheld and the generation is
 *                 stopped (`stop`), and the job discards the stage. After a Write or Edit, the project the file is
 *                 in is type-checked and the new errors are added to the result, so the agent fixes them right away.
 *   Stop          when the agent wants to finish, checks the code (`verify`); if something's wrong, the errors are
 *                 sent back and it keeps going, up to CODEGEN_FIX_ROUNDS times. Missing or wrong object cards are
 *                 sent back too, but never fail the generation: the job leaves such a card out (see objects.ts).
 * Instructions come only from Claude Code's system prompt with rules.md appended, and the task (first.md or
 * second.md): settings, CLAUDE.md files, skills and plugins on this machine aren't loaded, and the session isn't saved.
 *
 * Limits (environment variables, e.g. in .env.local). Reaching one stops the generation, and the job discards
 * everything it wrote:
 *   CODEGEN_MAX_BUDGET_USD   default 5 ("none" for no limit): the SDK's estimate of the cost
 *   CODEGEN_MAX_TURNS        default 120
 *   CODEGEN_FIX_ROUNDS       default 3: how often the agent is sent back to fix its code; still wrong after that is a stop
 * And:
 *   ANTHROPIC_API_KEY        required, unless Claude Code is signed in on this machine
 *   CODEGEN_MODEL            default claude-opus-5-5
 *   CODEGEN_EFFORT           low | medium | high | xhigh | max, default high
 */
export const MODEL = process.env.CODEGEN_MODEL || "claude-opus-5-5";
const EFFORTS: readonly EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];
export const EFFORT: EffortLevel = EFFORTS.find((level) => level === process.env.CODEGEN_EFFORT) ?? "high";
export const MAX_TURNS = positiveNumber(process.env.CODEGEN_MAX_TURNS) ?? 120;
export const MAX_BUDGET_USD = /^(none|off)$/i.test(process.env.CODEGEN_MAX_BUDGET_USD ?? "")
  ? undefined
  : (positiveNumber(process.env.CODEGEN_MAX_BUDGET_USD) ?? 5);
export const MAX_FIX_ROUNDS = wholeNumber(process.env.CODEGEN_FIX_ROUNDS) ?? 3;

const SERVER_NAME = "ship";
const TYPECHECK_TOOL = `mcp__${SERVER_NAME}__typecheck`;
/** Built-in tools the agent gets. Bash, web access, subagents and the rest stay unavailable. */
const BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const WRITE_TOOLS = new Set(["Write", "Edit"]);
/** Lines of the Claude Code process's stderr kept for error messages. */
const STDERR_LINES = 20;
/** The PostToolUse and Stop hooks type-check the project, which can wait for a check already running (3 min each at most). */
const CHECK_HOOK_TIMEOUT_S = 400;

function positiveNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? number : undefined;
}

function wholeNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp";

/** The image files sent to the agent with the task, by extension. Others (SVG) are read as text instead. */
export const IMAGE_MEDIA_TYPES: Record<string, ImageMediaType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** An image sent with the task. */
export interface AgentImage {
  /** Says what it is, sent just before it, e.g. which object it shows. */
  caption: string;
  mediaType: ImageMediaType;
  /** Base64. */
  data: string;
}

export interface AgentRequest {
  /** Appended to Claude Code's system prompt. */
  system: string;
  /** The task, sent as the first user message. */
  prompt: string;
  /**
   * Sent with the prompt, before it: the line diagram (unless it's an SVG, which the agent reads as text), and the
   * images of the objects new to the ship's code.
   */
  images: AgentImage[];
  /** The policy for the stage: its copies of the ship and template are where the agent works. */
  policy: CodegenPolicy;
  journal: FileJournal;
  /** Aborting it stops the agent. */
  controller: AbortController;
  /** For the typecheck tool: the type errors to fix, in the ship's project and, once it's changed, the template. */
  typecheck: () => Promise<string>;
  /**
   * After a write to `target` (absolute): the new type errors of the project it's in (the ship's or the template),
   * with paths as the agent sees them (policy.label).
   */
  errorsAfterWrite: (target: string) => Promise<Diagnostic[]>;
  /**
   * Files the agent must read before its first write, relative to the ship's folder; one ending in "/" means any
   * file in that folder.
   */
  readFirst: string[];
  /**
   * What's still wrong, for the agent to fix, each null when nothing is: `own`, the section's own code (if it stays
   * wrong, the generation fails); `shared`, its change to the template (if it stays wrong, only that is rejected);
   * `cards`, the cards of the objects it was shown (if they stay wrong, they're left out).
   */
  verify: () => Promise<{ own: string | null; shared: string | null; cards: string | null }>;
  /** Stops the generation because something went wrong (a path changed under a tool call): it fails, with `reason`. */
  stop: (reason: string) => void;
  /** Called with a short description of each step, e.g. "Writing src/sections/bunker/Diagram2D.tsx". */
  onProgress: (step: string) => void;
  /** Called with the usage so far, as it grows and at the end (however the generation ends). */
  onUsage: (usage: CodegenUsage) => void;
  /** The interactive Claude Code CLI session ID, when supplied by its init event. */
  onCliSession?: (sessionId: string) => void;
  /** The CLI process exit code. */
  onCliExit?: (exitCode: number | null) => void;
  /** Per-invocation limits; used to account for CLI repair sessions. */
  maxTurns?: number;
  maxBudgetUsd?: number;
}

export interface AgentOutcome {
  /** The agent's closing summary. */
  summary: string;
  costUsd?: number;
  /** How often the agent was sent back to fix its code when it wanted to finish. */
  fixRounds: number;
  sessionId?: string;
  exitCode?: number;
  turns?: number;
}

/** The agent didn't finish its task. */
export class AgentError extends Error {
  constructor(
    message: string,
    public costUsd?: number,
    /** The configured limit it reached, if that's why. */
    public limit?: CodegenLimit,
  ) {
    super(message);
  }
}

type Decision = { allow: true; input?: Record<string, unknown> } | { allow: false; reason: string };

/** The required reads (see AgentRequest.readFirst) the agent hasn't done yet. */
function unreadRequirements(readFirst: string[], read: Set<string>): string[] {
  return readFirst.filter((required) =>
    required.endsWith("/") ? ![...read].some((file) => file.startsWith(required)) : !read.has(required),
  );
}

/**
 * Whether a tool call may run, and with which input: the checked absolute path in place of the one given. `read`
 * collects the files the agent reads (policy.label). Writes are refused until it has read the files its code builds
 * on, and recorded in the journal before they're allowed.
 */
async function decide(request: AgentRequest, read: Set<string>, toolName: string, input: Record<string, unknown>): Promise<Decision> {
  const { policy, journal } = request;
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : undefined);

  switch (toolName) {
    case "Read": {
      const result = await policy.checkRead(text("file_path") ?? "");
      if ("refused" in result) return { allow: false, reason: result.refused };
      read.add(policy.label(result.target));
      return { allow: true, input: { ...input, file_path: result.target } };
    }
    case "Glob":
    case "Grep": {
      const pattern = toolName === "Glob" ? text("pattern") : text("glob");
      const refused = pattern ? checkPattern(pattern) : null;
      if (refused) return { allow: false, reason: refused };
      const result = await policy.checkSearch(text("path") ?? ".");
      if ("refused" in result) return { allow: false, reason: result.refused };
      return { allow: true, input: { ...input, path: result.target } };
    }
    case "Write":
    case "Edit": {
      const result = await policy.checkWrite(text("file_path") ?? "");
      if ("refused" in result) return { allow: false, reason: result.refused };
      const unread = unreadRequirements(request.readFirst, read);
      if (unread.length) {
        const list = unread.map((file) => (file.endsWith("/") ? `at least one file in \`${file}\`` : `\`${file}\``));
        return {
          allow: false,
          reason: `Read the files your code builds on before writing anything: ${list.join(", ")}. Then write ${policy.label(result.target)} to fit them.`,
        };
      }
      await journal.remember(result.target);
      return { allow: true, input: { ...input, file_path: result.target } };
    }
    case TYPECHECK_TOOL: {
      // tsc reads the stage's projects whole, so they must hold no links.
      const found = await scanForLinks(policy.stage ?? policy.root);
      if (found === "too-big" || !found) return { allow: true };
      request.stop(`A link appeared in the generation's working copy (${toLabel(found)}), so it was stopped.`);
      return { allow: false, reason: "The working copy changed unexpectedly, so the generation is stopping." };
    }
    default:
      return { allow: false, reason: `${toolName} isn't available here.` };
  }
}

/** A short description of an assistant message's tool calls, for the Library's progress line. */
function describe(request: AgentRequest, message: SDKAssistantMessage): string | undefined {
  let step: string | undefined;
  for (const block of message.message.content) {
    if (block.type !== "tool_use") continue;
    const input = (block.input ?? {}) as Record<string, unknown>;
    const file = typeof input.file_path === "string" ? request.policy.label(path.resolve(request.policy.root, input.file_path)) : "";
    step =
      block.name === "Read"
        ? `Reading ${file}`
        : block.name === "Write"
          ? `Writing ${file}`
          : block.name === "Edit"
            ? `Editing ${file}`
            : block.name === TYPECHECK_TOOL
              ? "Type-checking the project"
              : "Looking through the project";
  }
  return step;
}

function failureOf(result: SDKResultMessage): { message: string; limit?: CodegenLimit } {
  switch (result.subtype) {
    case "success":
      return { message: result.result || "The agent ended with an error." };
    case "error_max_turns":
      return { message: `The agent used all of its ${MAX_TURNS} turns (CODEGEN_MAX_TURNS), so it was stopped.`, limit: "turns" };
    case "error_max_budget_usd":
      return { message: `The agent reached its budget of $${MAX_BUDGET_USD} (CODEGEN_MAX_BUDGET_USD), so it was stopped.`, limit: "budget" };
    default:
      return { message: result.errors.join(" ") || "The agent stopped because of an error." };
  }
}

/**
 * What the agent is told after it writes `file`: the project's new type errors, those in that file first. Clean
 * results are reported too, so the agent knows an error it fixed is gone.
 */
function writeReport(file: string, fresh: Diagnostic[]): string {
  if (fresh.length === 0) return "Type check after this change: no new type errors in the project.";
  const here = fresh.filter((diagnostic) => diagnostic.file === file);
  const elsewhere = fresh.filter((diagnostic) => diagnostic.file !== file);
  const parts = [
    here.length
      ? `Type check after this change: ${here.length} error(s) in ${file}. Fix them before going on:\n${diagnosticsBlock(here)}`
      : `Type check after this change: no errors in ${file}.`,
  ];
  if (elsewhere.length) {
    parts.push(
      `${elsewhere.length} new error(s) in other files. One about a module you haven't written yet goes away once you ` +
        "write it. One in a file you didn't change (e.g. another section's code) means a change of yours broke it: " +
        `adjust your change, so that file keeps working as it is.\n${diagnosticsBlock(elsewhere)}`,
    );
  }
  return parts.join("\n\n");
}

/** Adds up a run's usage: from the result when there is one, else from the messages so far (deduplicated by ID). */
class UsageMeter {
  private readonly byMessage = new Map<string, { input: number; output: number; cacheWrite: number; cacheRead: number }>();
  private model = MODEL;

  add(message: SDKAssistantMessage) {
    const { id, usage, model } = message.message;
    if (model) this.model = model;
    if (!usage) return;
    this.byMessage.set(id, {
      input: usage.input_tokens ?? 0,
      output: usage.output_tokens ?? 0,
      cacheWrite: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    });
  }

  /** So far: no cost or turns until the SDK reports them. */
  current(): CodegenUsage {
    const totals = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };
    for (const usage of this.byMessage.values()) {
      totals.inputTokens += usage.input;
      totals.outputTokens += usage.output;
      totals.cacheCreationInputTokens += usage.cacheWrite;
      totals.cacheReadInputTokens += usage.cacheRead;
    }
    return { model: this.model, ...totals };
  }

  /** As the SDK reported it at the end: every model call, with its cost estimate. */
  final(result: SDKResultMessage): CodegenUsage {
    const models = Object.entries(result.modelUsage);
    if (models.length === 0) return { ...this.current(), costUsd: result.total_cost_usd, turns: result.num_turns };
    const sum = (pick: (usage: (typeof models)[number][1]) => number) => models.reduce((total, [, usage]) => total + pick(usage), 0);
    return {
      model: models.map(([model]) => model).join(", "),
      inputTokens: sum((usage) => usage.inputTokens),
      outputTokens: sum((usage) => usage.outputTokens),
      cacheCreationInputTokens: sum((usage) => usage.cacheCreationInputTokens),
      cacheReadInputTokens: sum((usage) => usage.cacheReadInputTokens),
      costUsd: result.total_cost_usd,
      turns: result.num_turns,
    };
  }
}

export async function runAgent(request: AgentRequest): Promise<AgentOutcome> {
  // Loaded on first use, so the rest of the API doesn't load the SDK.
  const { createSdkMcpServer, query, tool } = await import("@anthropic-ai/claude-agent-sdk");
  const { policy } = request;

  const shipTools = createSdkMcpServer({
    name: SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        "typecheck",
        "Type-check the whole ship project the way its build does (tsc with tsconfig.app.json), and the template too once you've changed it. Reports the type errors to fix, apart from any the projects already had.",
        {},
        async () => ({ content: [{ type: "text", text: await request.typecheck() }] }),
      ),
    ],
  });

  /** Files the agent has read (policy.label). */
  const read = new Set<string>();
  const guard: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const decision = await decide(request, read, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision.allow ? "allow" : "deny",
        permissionDecisionReason: decision.allow ? undefined : decision.reason,
        updatedInput: decision.allow ? decision.input : undefined,
      },
    };
  };

  /** A tool's result withheld because its path changed under it; the generation is stopped. */
  const withhold = (reason: string): HookJSONOutput => {
    request.stop(`${reason} The generation was stopped, and nothing it wrote was kept.`);
    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedToolOutput: "The result was withheld: the files changed while the tool ran. The generation is stopping.",
      },
    };
  };

  // After every tool call: the path it used, and the stage, must still be as they were checked. After a write, the
  // project's new type errors go back to the agent with the tool's result.
  const afterTool: HookCallback = async (input) => {
    if (input.hook_event_name !== "PostToolUse") return {};
    const toolInput = (input.tool_input ?? {}) as Record<string, unknown>;
    const given = typeof toolInput.file_path === "string" ? toolInput.file_path : typeof toolInput.path === "string" ? toolInput.path : undefined;
    if (given !== undefined) {
      const target = path.resolve(policy.root, given);
      const problem = input.tool_name === "Glob" || input.tool_name === "Grep" ? await searchProblem(target) : await policy.verify(target);
      if (problem) return withhold(problem);
    }
    const found = await scanForLinks(policy.stage ?? policy.root);
    if (found && found !== "too-big") return withhold(`A link appeared in the generation's working copy (${toLabel(found)}).`);

    if (!WRITE_TOOLS.has(input.tool_name) || given === undefined) return {};
    const target = path.resolve(policy.root, given);
    const file = policy.label(target);
    request.onProgress(`Type-checking ${file}`);
    const report = writeReport(file, await request.errorsAfterWrite(target));
    return { hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report } };
  };
  const searchProblem = async (target: string) => {
    const problem = await policy.verify(target);
    if (problem) return problem;
    const found = await scanForLinks(target);
    return found && found !== "too-big" ? `${toLabel(found)} is a link or a hard-linked file.` : null;
  };

  // When the agent wants to finish: anything still wrong sends it back to fix it, CODEGEN_FIX_ROUNDS times at most.
  // Still wrong after that is a limit reached: the generation fails and everything is discarded. Problems only with
  // the template change or the object cards, just as they were when it was last sent back, mean it chose to leave
  // them (it may): it's let go, and the job rejects the template change, or leaves those cards out, alone. Object
  // cards alone never reach the limit.
  let fixRounds = 0;
  let lastShared: string | null = null;
  let lastCards: string | null = null;
  let fixLimit: string | null = null;
  const checkFinish: HookCallback = async (input) => {
    if (input.hook_event_name !== "Stop") return {};
    request.onProgress("Checking the generated code");
    const { own, shared, cards } = await request.verify();
    if (!own && !shared && !cards) return {};
    if (!own && shared === lastShared && cards === lastCards) return {};
    if (fixRounds >= MAX_FIX_ROUNDS) {
      if (own || shared !== lastShared) fixLimit = [own, shared].filter(Boolean).join("\n\n");
      return {};
    }
    lastShared = shared;
    lastCards = cards;
    fixRounds += 1;
    request.onProgress(`Fixing errors in the generated code (round ${fixRounds} of ${MAX_FIX_ROUNDS})`);
    console.info(`Code generation: sent the agent back to fix its code (round ${fixRounds} of ${MAX_FIX_ROUNDS}).`);
    const parts: string[] = [];
    if (own) {
      parts.push(`The code isn't finished yet:\n\n${own}\n\nRead the files involved, and fix these. Run typecheck until it reports no new errors.`);
    }
    if (shared) {
      parts.push(
        `Your change to the template can't be kept as it is:\n\n${shared}\n\nMake it work for the template and for those ships, ` +
          "for example with a new optional prop rather than a changed one, and read their files if you need to (you can't " +
          "change other ships). If it can't be, leave it as it is: the change to the template is then rejected (undone), " +
          "and the change stays in this ship only.",
      );
    }
    if (cards) {
      parts.push(
        `Some object cards are missing or wrong:\n\n${cards}\n\nWrite each one as the task describes, from the object's image. ` +
          "A card that's still missing or wrong is left out, and that object's image is sent again next time.",
      );
    }
    if (fixRounds === MAX_FIX_ROUNDS) {
      parts.push("This is the last round: if these problems are still there when you finish, the generation fails and everything you wrote is discarded.");
    }
    parts.push("Then reply with your summary again.");
    return { decision: "block", reason: parts.join("\n\n") };
  };

  // The prompt is streamed so the drawing and the new objects' images can go with it, each after its caption. The
  // stream stays open until the result arrives, since closing it ends the session.
  let endInput = () => {};
  const inputEnded = new Promise<void>((resolve) => (endInput = resolve));
  async function* input(): AsyncGenerator<SDKUserMessage> {
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          ...request.images.flatMap((image) => [
            { type: "text" as const, text: image.caption },
            { type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType, data: image.data } },
          ]),
          { type: "text" as const, text: request.prompt },
        ],
      },
    };
    await inputEnded;
  }

  const stderr: string[] = [];
  const session = query({
    prompt: input(),
    options: {
      cwd: policy.root,
      // So Claude Code's own file tools reach the stage's template and the other ships (to read); the PreToolUse hook
      // still decides every call.
      additionalDirectories: [policy.child],
      model: MODEL,
      effort: EFFORT,
      systemPrompt: { type: "preset", preset: "claude_code", append: request.system },
      tools: BUILTIN_TOOLS,
      mcpServers: { [SERVER_NAME]: shipTools },
      // Every tool call is decided by the PreToolUse hook (canUseTool only refuses what it doesn't decide); if the hook
      // itself fails, the call is blocked. A failed check after a tool call or before stopping is only skipped: the
      // job checks the code again once the agent is done, and checks every path again when it applies the stage.
      hooks: {
        PreToolUse: [{ hooks: [guard], onFailure: "block" }],
        PostToolUse: [{ hooks: [afterTool], timeout: CHECK_HOOK_TIMEOUT_S }],
        Stop: [{ hooks: [checkFinish], timeout: CHECK_HOOK_TIMEOUT_S }],
      },
      permissionMode: "default",
      canUseTool: async (toolName) => ({ behavior: "deny", message: `${toolName} isn't available here.` }),
      // Only the system prompt and the task are instructions: nothing from this machine's Claude Code setup (no
      // settings or CLAUDE.md files, no other MCP servers, and, when it's signed in with a Claude account, none of that
      // account's connectors, skills or plugins). Besides giving the agent tools it mustn't have, a signed-in account's
      // connectors add their tool definitions to every request, which made a short run cost dozens of times more.
      settingSources: [],
      strictMcpConfig: true,
      settings: { disableClaudeAiConnectors: true, syncClaudeAiSkills: false, syncClaudeAiPlugins: false },
      skills: [],
      persistSession: false,
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET_USD,
      abortController: request.controller,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "ship-docs-codegen/0.1.0" },
      stderr: (data) => {
        stderr.push(...data.split(/\r?\n/).filter(Boolean));
        stderr.splice(0, Math.max(0, stderr.length - STDERR_LINES));
      },
    },
  });
  const meter = new UsageMeter();
  let result: SDKResultMessage | undefined;
  try {
    for await (const message of session) {
      if (message.type === "assistant") {
        meter.add(message);
        request.onUsage(meter.current());
        const step = message.parent_tool_use_id ? undefined : describe(request, message);
        if (step) request.onProgress(step);
      } else if (message.type === "result") {
        result = message;
        break;
      }
    }
  } catch (error) {
    if (request.controller.signal.aborted) throw error;
    const detail = stderr.length ? ` ${stderr.slice(-3).join(" ")}` : "";
    throw new AgentError(`The agent couldn't run: ${error instanceof Error ? error.message : String(error)}.${detail}`);
  } finally {
    endInput();
    session.close();
  }

  if (!result) throw new AgentError("The agent stopped without finishing.");
  request.onUsage(meter.final(result));
  logUsage(result);
  if (result.subtype !== "success" || result.is_error) {
    const { message, limit } = failureOf(result);
    throw new AgentError(message, result.total_cost_usd, limit);
  }
  if (fixLimit) {
    throw new AgentError(
      `The code still had problems after ${MAX_FIX_ROUNDS} round(s) of fixes (CODEGEN_FIX_ROUNDS), so it was discarded:\n\n${fixLimit}`,
      result.total_cost_usd,
      "fixRounds",
    );
  }
  return { summary: result.result, costUsd: result.total_cost_usd, fixRounds, turns: result.num_turns };
}

/** One line per model in the server log, so the cost of a generation can be traced. */
function logUsage(result: SDKResultMessage) {
  const models = Object.entries(result.modelUsage).map(
    ([model, usage]) =>
      `${model}: ${usage.inputTokens} input, ${usage.cacheCreationInputTokens} cache write, ${usage.cacheReadInputTokens} cache read, ` +
      `${usage.outputTokens} output tokens, $${usage.costUSD.toFixed(3)}`,
  );
  console.info(`Code generation: ${result.num_turns} turns, $${result.total_cost_usd.toFixed(3)}. ${models.join("; ")}`);
}
