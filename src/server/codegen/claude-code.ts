import type { Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * How this app runs Claude Code (through the Claude Agent SDK): always on the Claude plan it's signed in with on this
 * machine (Pro, Max…; sign in with `claude`, then /login), never on an API key.
 */

/** The environment Claude Code runs with: this process's, without ANTHROPIC_API_KEY, which would take precedence over the signed-in plan. */
export function claudeCodeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "ship-docs-codegen/0.1.0" };
  delete env.ANTHROPIC_API_KEY;
  return env;
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
