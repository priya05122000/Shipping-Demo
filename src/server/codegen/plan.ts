import type { SDKControlGetUsageResponse, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PlanUsage, PlanUsageWindow } from "@/types/records";
import { claudeCodeEnv, ISOLATED } from "./claude-code";
import { runtime } from "./runtime";

/**
 * The usage limits of the Claude plan Claude Code is signed in with (Pro, Max…), which code generation runs on.
 *   - readPlanUsage reads them: the data behind Claude Code's /usage (the 5-hour session, the week, and any per-model
 *     week). The Library shows it, and each generation checks it before it starts.
 *   - When a limit is reached, generations wait until it resets, then start again on their own (jobs.ts): before one
 *     starts, if the limit is already reached, and when the agent reaches it while working (agent.ts throws
 *     PlanLimitError; the job discards what it wrote and starts again after the reset).
 * Reading the usage starts Claude Code without sending a prompt, so it uses none of the plan. The SDK marks the call
 * experimental: if it fails, the usage shows as unavailable, generations start without the check, and a limit the
 * agent reaches still makes them wait.
 */

/** Usage read this recently is reused; a read asked to be fresh reuses one only this recent. */
const CACHE_MS = 60_000;
const FRESH_MS = 5_000;
const READ_TIMEOUT_MS = 30_000;
/** How long to wait when a limit is reached but its reset time isn't known, before checking again. */
export const UNKNOWN_RESET_WAIT_MS = 10 * 60_000;
/** setTimeout's longest delay; longer waits are done in steps. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** The agent stopped because the Claude plan's usage limit was reached. */
export class PlanLimitError extends Error {
  constructor(
    /** When the limit resets, if Claude Code said. */
    public readonly resetsAt?: Date,
  ) {
    super(
      resetsAt
        ? `The Claude plan's usage limit was reached; it resets at ${resetsAt.toISOString()}.`
        : "The Claude plan's usage limit was reached.",
    );
  }
}

/** The plan's usage: read again if the last read is older than a minute, or with `fresh`. Never rejects. */
export async function readPlanUsage(options: { fresh?: boolean } = {}): Promise<PlanUsage> {
  let cached = runtime.planUsage;
  if (!cached || Date.now() - cached.at >= (options.fresh ? FRESH_MS : CACHE_MS)) {
    cached = { read: fetchPlanUsage(), at: Date.now() };
    runtime.planUsage = cached;
  }
  const usage = await cached.read;
  return runtime.planWait ? { ...usage, waitingUntil: runtime.planWait } : usage;
}

/**
 * When the plan's limits that hold back `model` reset, if one is reached (the latest, as all must have reset);
 * undefined if none is, or the usage can't be read.
 */
export async function planLimitUntil(model: string, options: { fresh?: boolean } = {}): Promise<Date | undefined> {
  const usage = await readPlanUsage(options);
  let until: number | undefined;
  for (const window of usage.windows) {
    if (window.model && !model.toLowerCase().includes(window.model.toLowerCase())) continue;
    if (window.utilization === null || window.utilization < 100) continue;
    const resets = window.resetsAt ? Date.parse(window.resetsAt) : Number.NaN;
    until = Math.max(until ?? 0, Number.isFinite(resets) ? resets : Date.now() + UNKNOWN_RESET_WAIT_MS);
  }
  return until === undefined ? undefined : new Date(until);
}

/** Shown with the plan's usage while generations wait for a limit to reset; undefined once they don't. */
export function setPlanWait(until: string | undefined) {
  runtime.planWait = until;
}

/** Resolves at `time`, or rejects with the signal's reason when it's aborted first. */
export function sleepUntil(time: Date, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      },
      Math.min(Math.max(0, time.getTime() - Date.now()), MAX_TIMEOUT_MS),
    );
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** A Claude Code reset time (epoch seconds, or milliseconds) as a Date, if it's one. */
export function resetTime(value: number | undefined): Date | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return new Date(value < 1e12 ? value * 1000 : value);
}

/** Asks Claude Code for the plan's usage, without a prompt. */
async function fetchPlanUsage(): Promise<PlanUsage> {
  const checkedAt = new Date().toISOString();
  // The session's input stays open, without a message, until the answer is in; closing it ends the session.
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  const noPrompt: AsyncIterable<SDKUserMessage> = {
    [Symbol.asyncIterator]: () => ({ next: () => released.then(() => ({ done: true, value: undefined })) }),
  };
  let timer: NodeJS.Timeout | undefined;
  try {
    // Loaded on first use, like agent.ts, so the rest of the API doesn't load the SDK.
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const session = query({ prompt: noPrompt, options: { ...ISOLATED, tools: [], env: claudeCodeEnv() } });
    try {
      const usage = await Promise.race([
        session.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Claude Code didn't answer within ${READ_TIMEOUT_MS / 1000} s.`)), READ_TIMEOUT_MS);
        }),
      ]);
      return toPlanUsage(usage, checkedAt);
    } finally {
      release();
      session.close();
    }
  } catch (error) {
    console.warn("Couldn't read the Claude plan's usage:", error);
    const reason = error instanceof Error ? error.message : String(error);
    return { available: false, subscription: null, windows: [], checkedAt, error: `Couldn't read the Claude plan's usage: ${reason}` };
  } finally {
    clearTimeout(timer);
  }
}

type UsageWindow = { utilization: number | null; resets_at: string | null } | null | undefined;

function toPlanUsage(usage: SDKControlGetUsageResponse, checkedAt: string): PlanUsage {
  const subscription = typeof usage.subscription_type === "string" ? usage.subscription_type : null;
  const limits = usage.rate_limits;
  if (!usage.rate_limits_available || !limits) {
    return {
      available: false,
      subscription,
      windows: [],
      checkedAt,
      error: subscription
        ? "Claude Code didn't report this plan's usage limits."
        : "Claude Code on this machine isn't signed in with a Claude plan: run `claude`, then /login.",
    };
  }
  const windows: PlanUsageWindow[] = [];
  const add = (label: string, window: UsageWindow, model?: string) => {
    if (!window) return;
    const utilization = typeof window.utilization === "number" && Number.isFinite(window.utilization) ? Math.max(0, window.utilization) : null;
    const resets = typeof window.resets_at === "string" ? Date.parse(window.resets_at) : Number.NaN;
    windows.push({ label, utilization, resetsAt: Number.isFinite(resets) ? new Date(resets).toISOString() : null, ...(model && { model }) });
  };
  add("Current session (5 hours)", limits.five_hour);
  add("This week, all models", limits.seven_day);
  add("This week, Opus", limits.seven_day_opus, "Opus");
  add("This week, Sonnet", limits.seven_day_sonnet, "Sonnet");
  for (const scoped of limits.model_scoped ?? []) {
    if (typeof scoped?.display_name === "string") add(`This week, ${scoped.display_name}`, scoped, scoped.display_name);
  }
  return { available: true, subscription, windows, checkedAt };
}
