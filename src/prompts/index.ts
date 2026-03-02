/**
 * Barrel export for all MCP prompts.
 */

import type { PromptDefinition, PromptMessage } from './types.js';
import { toolGuidePrompts } from './tool-guides.js';
import { workflowPrompts } from './workflows.js';

export type { PromptDefinition, PromptArgument, PromptMessage } from './types.js';

export const allPrompts: PromptDefinition[] = [
  ...toolGuidePrompts,
  ...workflowPrompts,
];

/**
 * Look up a prompt by name and return its messages (with arguments interpolated).
 * Returns undefined if the prompt is not found.
 */
export function getPromptByName(
  name: string,
  args?: Record<string, string>,
): { definition: PromptDefinition; messages: PromptMessage[] } | undefined {
  const definition = allPrompts.find((p) => p.name === name);
  if (!definition) return undefined;
  return { definition, messages: definition.getMessages(args) };
}
