/**
 * Scene Prose Writer System Prompt — the prose-craft role.
 *
 * High-level identity only. Format rules, tone cue, author voice override,
 * and scene direction are now passed via the user prompt
 * (buildSceneProseUserPrompt) so this prompt stays a stable role statement.
 */

import type { FormatInstructionSet } from "../prose/format-instructions";

export type SceneProseSystemPromptArgs = {
  formatInstructions: FormatInstructionSet;
  narrativeTitle: string;
  /** @deprecated Tone cue moved to user prompt; kept for call-site compatibility. */
  worldSummary?: string;
  /** @deprecated Voice override moved to user prompt; kept for call-site compatibility. */
  proseVoiceOverride?: string;
  /** @deprecated Scene direction moved to user prompt; kept for call-site compatibility. */
  direction?: string;
};

export function buildSceneProseSystemPrompt(
  args: SceneProseSystemPromptArgs,
): string {
  return `${args.formatInstructions.systemRole} You are crafting a single scene for "${args.narrativeTitle}". Follow the prose profile, format rules, and scene direction supplied in the user prompt.`;
}
