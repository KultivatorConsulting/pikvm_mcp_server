/**
 * Auto-generates MCP tools from prompt definitions so that skill/guide
 * content is discoverable via `tools/list` (e.g. in marketplace listings)
 * in addition to `prompts/list`.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PromptArgument } from './types.js';
import { allPrompts, getPromptByName } from './index.js';

// ============================================================================
// Name conversion helpers
// ============================================================================

/** 'take-screenshot' → 'skill_take_screenshot' */
function promptNameToToolName(name: string): string {
  return 'skill_' + name.replace(/-/g, '_');
}

/** 'skill_take_screenshot' → 'take-screenshot' */
function toolNameToPromptName(name: string): string {
  return name.slice('skill_'.length).replace(/_/g, '-');
}

// ============================================================================
// JSON Schema helpers
// ============================================================================

function buildProperties(args?: PromptArgument[]): Record<string, object> {
  if (!args || args.length === 0) return {};
  const props: Record<string, object> = {};
  for (const arg of args) {
    props[arg.name] = {
      type: 'string',
      description: arg.description,
    };
  }
  return props;
}

function buildRequired(args?: PromptArgument[]): string[] {
  if (!args) return [];
  return args.filter((a) => a.required).map((a) => a.name);
}

// ============================================================================
// Generated tool list
// ============================================================================

export const skillTools: Tool[] = allPrompts.map((prompt) => {
  const required = buildRequired(prompt.arguments);
  return {
    name: promptNameToToolName(prompt.name),
    description: prompt.description,
    inputSchema: {
      type: 'object' as const,
      properties: buildProperties(prompt.arguments),
      ...(required.length > 0 ? { required } : {}),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  };
});

// ============================================================================
// Runtime helpers
// ============================================================================

/** Returns true if the tool name belongs to a skill tool. */
export function isSkillTool(name: string): boolean {
  return name.startsWith('skill_');
}

/** Handle a skill tool call by delegating to the underlying prompt. */
export function handleSkillToolCall(
  name: string,
  args: Record<string, unknown> = {},
): { content: Array<{ type: 'text'; text: string }> } {
  const promptName = toolNameToPromptName(name);
  const stringArgs: Record<string, string> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') {
      stringArgs[k] = v;
    }
  }
  const result = getPromptByName(promptName, stringArgs);
  if (!result) {
    throw new Error(`Unknown skill tool: ${name}`);
  }
  const text = result.messages.map((m) => m.content.text).join('\n\n');
  return { content: [{ type: 'text', text }] };
}
