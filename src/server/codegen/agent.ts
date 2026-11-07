import path from "node:path";
import type { EffortLevel, HookCallback, SDKAssistantMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { checkPattern, type CodegenPolicy, type FileJournal } from "./policy";

/**
 * Runs the Claude Agent SDK (Claude Code as a library) in a ship's project folder to write a section's React code.
 *
 * The agent gets only file tools (Read, Write, Edit, Glob, Grep) and a `typecheck` tool, so it can't run commands or
 * reach the web. A PreToolUse hook checks every file call against the CodegenPolicy (read the ship's folder, write
 * the section's and the shared schematic folder) and records each file before its first change, so the job can roll
 * back. Settings, CLAUDE.md files and plugins on this machine aren't loaded, and the session isn't saved.
 *
 * Configured with environment variables (e.g. in .env.local):
 *   ANTHROPIC_API_KEY        required, unless Claude Code is signed in on this machine
 *   CODEGEN_MODEL            default claude-opus-5-5
 *   CODEGEN_EFFORT           low | medium | high | xhigh | max, default high
 *   CODEGEN_MAX_TURNS        default 120
 *   CODEGEN_MAX_BUDGET_USD   optional: stop a generation that would cost more than this
 */
const MODEL = process.env.CODEGEN_MODEL || "claude-opus-5-5";
const EFFORTS: readonly EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];
const EFFORT: EffortLevel = EFFORTS.find((level) => level === process.env.CODEGEN_EFFORT) ?? "high";
const MAX_TURNS = positiveNumber(process.env.CODEGEN_MAX_TURNS) ?? 120;
const MAX_BUDGET_USD = positiveNumber(process.env.CODEGEN_MAX_BUDGET_USD);

const SERVER_NAME = "ship";
const TYPECHECK_TOOL = `mcp__${SERVER_NAME}__typecheck`;
/** Built-in tools the agent gets. Bash, web access, subagents and the rest stay unavailable. */
const BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
/** Lines of the Claude Code process's stderr kept for error messages. */
const STDERR_LINES = 20;

function positiveNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? number : undefined;
}

export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp";

export interface AgentRequest {
  /** Appended to Claude Code's system prompt. */
  system: string;
  /** The task, sent as the first user message. */
  prompt: string;
  /** The line diagram, sent with the prompt. Unset for SVG drawings, which the agent reads as text. */
  image?: { mediaType: ImageMediaType; data: string };
  policy: CodegenPolicy;
  journal: FileJournal;
  /** Aborting it stops the agent. */
  controller: AbortController;
  /** For the typecheck tool: a report of the ship's current type errors. */
  typecheck: () => Promise<string>;
  /** Called with a short description of each step, e.g. "Writing src/sections/bunker/Diagram2D.tsx". */
  onProgress: (step: string) => void;
}

export interface AgentOutcome {
  /** The agent's closing summary. */
  summary: string;
  costUsd: number;
}

/** The agent didn't finish its task. */
export class AgentError extends Error {
  constructor(
    message: string,
    public costUsd?: number,
  ) {
    super(message);
  }
}

type Decision = { allow: true } | { allow: false; reason: string };

/** Whether a tool call may run. Writes are recorded in the journal before they're allowed. */
async function decide(request: AgentRequest, toolName: string, input: Record<string, unknown>): Promise<Decision> {
  const { policy, journal } = request;
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : undefined);
  const checked = (result: { target: string } | { refused: string }): Decision =>
    "refused" in result ? { allow: false, reason: result.refused } : { allow: true };

  switch (toolName) {
    case "Read":
      return checked(await policy.checkRead(text("file_path") ?? ""));
    case "Glob":
    case "Grep": {
      const pattern = toolName === "Glob" ? text("pattern") : text("glob");
      const refused = pattern ? checkPattern(pattern) : null;
      return refused ? { allow: false, reason: refused } : checked(await policy.checkRead(text("path") ?? "."));
    }
    case "Write":
    case "Edit": {
      const result = await policy.checkWrite(text("file_path") ?? "");
      if ("refused" in result) return { allow: false, reason: result.refused };
      await journal.remember(result.target);
      return { allow: true };
    }
    case TYPECHECK_TOOL:
      return { allow: true };
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
    const file =
      typeof input.file_path === "string" ? request.policy.relative(path.resolve(request.policy.root, input.file_path)) : "";
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

function failureOf(result: SDKResultMessage): string {
  switch (result.subtype) {
    case "success":
      return result.result || "The agent ended with an error.";
    case "error_max_turns":
      return `The agent used all of its ${MAX_TURNS} turns without finishing (CODEGEN_MAX_TURNS).`;
    case "error_max_budget_usd":
      return `The agent reached its budget of $${MAX_BUDGET_USD} (CODEGEN_MAX_BUDGET_USD) without finishing.`;
    default:
      return result.errors.join(" ") || "The agent stopped because of an error.";
  }
}

export async function runAgent(request: AgentRequest): Promise<AgentOutcome> {
  // Loaded on first use, so the rest of the API doesn't load the SDK.
  const { createSdkMcpServer, query, tool } = await import("@anthropic-ai/claude-agent-sdk");

  const shipTools = createSdkMcpServer({
    name: SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        "typecheck",
        "Type-check the whole ship project the way its build does (tsc with tsconfig.app.json). Reports the type errors to fix, apart from any the project already had.",
        {},
        async () => ({ content: [{ type: "text", text: await request.typecheck() }] }),
      ),
    ],
  });

  const guard: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const decision = await decide(request, input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>);
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision.allow ? "allow" : "deny",
        permissionDecisionReason: decision.allow ? undefined : decision.reason,
      },
    };
  };

  // The prompt is streamed so the drawing can go with it as an image. The stream stays open until the result
  // arrives, since closing it ends the session.
  let endInput = () => {};
  const inputEnded = new Promise<void>((resolve) => (endInput = resolve));
  async function* input(): AsyncGenerator<SDKUserMessage> {
    const { image } = request;
    yield {
      type: "user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          ...(image ? [{ type: "image" as const, source: { type: "base64" as const, media_type: image.mediaType, data: image.data } }] : []),
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
      cwd: request.policy.root,
      model: MODEL,
      effort: EFFORT,
      systemPrompt: { type: "preset", preset: "claude_code", append: request.system },
      tools: BUILTIN_TOOLS,
      mcpServers: { [SERVER_NAME]: shipTools },
      // Every tool call is decided by the hook (canUseTool only refuses what it doesn't decide); if the hook itself
      // fails, the call is blocked.
      hooks: { PreToolUse: [{ hooks: [guard], onFailure: "block" }] },
      permissionMode: "default",
      canUseTool: async (toolName) => ({ behavior: "deny", message: `${toolName} isn't available here.` }),
      // Nothing from this machine's Claude Code setup: no settings or CLAUDE.md files, no other MCP servers, and,
      // when it's signed in with a Claude account, none of that account's connectors, skills or plugins. Besides
      // giving the agent tools it mustn't have, a signed-in account's connectors add their tool definitions to every
      // request, which made a short run cost dozens of times more.
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

  let result: SDKResultMessage | undefined;
  try {
    for await (const message of session) {
      if (message.type === "assistant" && !message.parent_tool_use_id) {
        const step = describe(request, message);
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
  logUsage(result);
  if (result.subtype !== "success" || result.is_error) throw new AgentError(failureOf(result), result.total_cost_usd);
  return { summary: result.result, costUsd: result.total_cost_usd };
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
