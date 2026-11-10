import type { AccountInfo, ApiKeySource, Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * How this app runs Claude Code (through the Claude Agent SDK): always on the Claude plan it's signed in with on this
 * machine (Pro, Max…; sign in with `claude`, then /login), never on the Claude API (an API key, an auth token, a
 * gateway, or a cloud provider). Two safeguards:
 *   - claudeCodeEnv leaves out every environment variable that would point Claude Code elsewhere. Next loads the
 *     .env files into process.env, so a key in .env.local would otherwise reach it.
 *   - planLoginProblem checks the login Claude Code reports, before a generation sends anything (agent.ts).
 */

/**
 * Variables Claude Code is never given: every ANTHROPIC_* one (API keys, auth tokens, base URLs, profiles, and the
 * cloud providers' settings) and the CLAUDE_CODE_USE_* switches (Bedrock, Vertex, Foundry, gateways…; the feature
 * switches that share the prefix don't apply to the agent's few tools). Windows' variable names ignore case.
 */
const NOT_THE_PLAN = /^(ANTHROPIC_|CLAUDE_CODE_USE_)/i;

/** The environment Claude Code runs with: this process's, without any variable that would take it off the Claude plan. */
export function claudeCodeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!NOT_THE_PLAN.test(key)) env[key] = value;
  }
  env.CLAUDE_AGENT_SDK_CLIENT_APP = "ship-docs-codegen/0.1.0";
  return env;
}

/** Where Claude Code's credential comes from when it's an API key, billed on the Claude API rather than a plan. */
const API_KEY_SOURCES: readonly string[] = ["ANTHROPIC_API_KEY", "apiKeyHelper", "/login managed key"] satisfies ApiKeySource[];

const SIGN_IN = "Sign Claude Code in with your Claude plan: run `claude`, then /login, and choose your Claude Pro or Max account.";

/** Why a credential from `source` (accountInfo's or system/init's apiKeySource) can't be used: it's an API key. Null otherwise. */
export function apiKeyProblem(source: string | undefined): string | null {
  return source && API_KEY_SOURCES.includes(source)
    ? `Claude Code on this machine uses an API key (${source}), not a Claude plan, so nothing was generated. ${SIGN_IN}`
    : null;
}

/**
 * Why Claude Code's login (Query.accountInfo) isn't a Claude plan, so a generation mustn't run on it; null when it is
 * one. A plan login reports its subscription; a token made with `claude setup-token` is one too, though it may not.
 */
export function planLoginProblem(account: AccountInfo): string | null {
  if (account.apiProvider && account.apiProvider !== "firstParty") {
    return `Claude Code on this machine is set up to use ${account.apiProvider}, not a Claude plan, so nothing was generated. ${SIGN_IN}`;
  }
  const apiKey = apiKeyProblem(account.apiKeySource);
  if (apiKey) return apiKey;
  if (account.subscriptionType || account.tokenSource === "CLAUDE_CODE_OAUTH_TOKEN") return null;
  const via = account.tokenSource ? ` (it's signed in through ${account.tokenSource})` : "";
  return `Claude Code on this machine isn't signed in with a Claude plan${via}, so nothing was generated. ${SIGN_IN}`;
}

/**
 * Nothing from this machine's Claude Code setup is loaded: no settings or CLAUDE.md files, no other MCP servers, and
 * none of the signed-in account's connectors, skills or plugins (they'd add tool definitions to every request, which
 * made a short run cost dozens of times more of the plan). Sessions aren't saved.
 */
export const ISOLATED: Pick<Options, "settingSources" | "strictMcpConfig" | "settings" | "skills" | "persistSession"> = {
  settingSources: [],
  strictMcpConfig: true,
  settings: { disableClaudeAiConnectors: true, syncClaudeAiSkills: false, syncClaudeAiPlugins: false },
  skills: [],
  persistSession: false,
};
