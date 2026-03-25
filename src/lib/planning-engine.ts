import type { NarrativeState, PlanningQueue, PlanningPhase } from '@/types/narrative';
import { callGenerate, SYSTEM_PROMPT } from './ai/api';
import { branchContext } from './ai/context';

/**
 * Generate a completion report for a phase that has finished its scene allocation.
 * Returns an AI summary of what was achieved vs. what was planned.
 */
export async function generatePhaseCompletionReport(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  phase: PlanningPhase,
): Promise<string> {
  const ctx = branchContext(narrative, resolvedKeys, currentIndex);

  const prompt = `${ctx}

TASK: A planning phase has completed its allocated scenes. Analyse the narrative state and produce a completion report.

PHASE: "${phase.name}"
OBJECTIVE: ${phase.objective}
SCENES ALLOCATED: ${phase.sceneAllocation}
SCENES COMPLETED: ${phase.scenesCompleted}
${phase.constraints ? `CONSTRAINTS: ${phase.constraints}` : ''}

Produce a concise completion report covering:
1. Was the objective met? (Yes/Partially/No)
2. What was accomplished — key events, thread changes, character developments
3. What remains open or unresolved from this phase's goals

Keep the report to 3-5 sentences. Be specific — use character NAMES, location NAMES, and thread DESCRIPTIONS, never raw IDs.
Return ONLY the report text, no JSON or markup.`;

  const report = await callGenerate(prompt, SYSTEM_PROMPT, 500, 'planningEngine');
  return report.trim();
}

/**
 * Generate direction and constraints for a new active phase.
 * Takes into account the branch context, the phase objectives,
 * and what the world expansion just created.
 */
export async function generatePhaseDirection(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  phase: PlanningPhase,
  queue: PlanningQueue,
): Promise<{ direction: string; constraints: string }> {
  const ctx = branchContext(narrative, resolvedKeys, currentIndex);

  // Build completed phases summary
  const completedSummary = queue.phases
    .filter((p) => p.status === 'completed' && p.completionReport)
    .map((p, i) => `Phase ${i + 1} "${p.name}": ${p.completionReport}`)
    .join('\n');

  // Build remaining phases preview
  const remaining = queue.phases
    .filter((p) => p.status === 'pending')
    .map((p) => `"${p.name}" (${p.sceneAllocation} scenes): ${p.objective}`)
    .join('\n');

  const prompt = `${ctx}

TASK: Generate direction and constraints for the next planning phase.

CURRENT PHASE: "${phase.name}"
OBJECTIVE: ${phase.objective}
SCENES ALLOCATED: ${phase.sceneAllocation}
${phase.constraints ? `PHASE CONSTRAINTS: ${phase.constraints}` : ''}
${phase.worldExpansionHints ? `WORLD EXPANSION CONTEXT: ${phase.worldExpansionHints}` : ''}

${completedSummary ? `COMPLETED PHASES:\n${completedSummary}\n` : ''}
${remaining ? `UPCOMING PHASES:\n${remaining}\n` : ''}

Generate:
1. A DIRECTION prompt (2-4 sentences) that tells the AI what to focus on during this phase. Be specific about which characters, threads, and locations should drive the action. Consider the pacing — this phase has ${phase.sceneAllocation} scenes to accomplish its objective.
2. A CONSTRAINTS prompt (1-2 sentences) listing what the AI must NOT do during this phase. Consider what would undermine the phase objective or prematurely resolve things needed for later phases.

IMPORTANT: Use character NAMES (e.g. "Harry", "Fang Yuan"), location NAMES (e.g. "Diagon Alley"), and thread DESCRIPTIONS — never raw IDs like C-01 or T-03.

Return JSON:
{
  "direction": "...",
  "constraints": "..."
}`;

  const response = await callGenerate(prompt, SYSTEM_PROMPT, 500, 'planningEngine');

  try {
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        direction: parsed.direction ?? '',
        constraints: parsed.constraints ?? '',
      };
    }
  } catch {
    // Fallback: use the phase objective as direction
  }

  return {
    direction: phase.objective,
    constraints: phase.constraints,
  };
}

/**
 * Generate a custom superstructure from a plan document.
 * The AI analyses the document and the current narrative state to produce
 * a sequence of phases with objectives, scene allocations, constraints,
 * and world expansion hints tailored to the story.
 */
export async function generateCustomPlan(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  planDocument: string,
): Promise<{ name: string; phases: { name: string; objective: string; sceneAllocation: number; constraints: string; worldExpansionHints: string }[] }> {
  const ctx = branchContext(narrative, resolvedKeys, currentIndex);

  const prompt = `${ctx}

TASK: Generate a narrative superstructure (planning queue) from the user's plan document below. This superstructure will guide book-length story generation phase by phase.

USER'S PLAN DOCUMENT:
${planDocument}

Analyse the plan document alongside the current narrative state. Produce a sequence of phases that:
1. Break the plan into distinct narrative phases (5-10 phases for a full book)
2. Each phase has a clear, evocative objective that captures the FEELING of that narrative moment — not just what happens but how it should resonate
3. Scene allocations are 6-9 scenes per phase
4. Constraints for each phase prevent premature resolution of elements needed later
5. World expansion hints describe what new characters, locations, or world elements each phase needs
6. The phases respect what already exists in the narrative — don't re-establish what's already built
7. Thread lifecycle management: which threads should escalate, which should remain dormant, which approach resolution
8. Character arcs: which characters drive each phase, how they should develop

IMPORTANT: Use character NAMES, location NAMES, and thread DESCRIPTIONS throughout — never raw IDs.

Return JSON:
{
  "name": "A short name for this superstructure (2-5 words)",
  "phases": [
    {
      "name": "Phase name (2-4 words, like a chapter title)",
      "objective": "Detailed objective (3-5 sentences). What must happen in this phase AND how it should FEEL — the emotional texture, the narrative rhythm, the reader's experience. Be specific about characters, threads, and the essence of this narrative moment.",
      "sceneAllocation": 7,
      "constraints": "What must NOT happen in this phase (1-2 sentences). What would undermine the plan if it happened too early.",
      "worldExpansionHints": "New characters, locations, world systems, or lore needed for this phase (1 sentence). Empty string if the existing world is sufficient."
    }
  ]
}`;

  const raw = await callGenerate(prompt, SYSTEM_PROMPT, 4000, 'generateCustomPlan');

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        name: parsed.name ?? 'Custom Plan',
        phases: (parsed.phases ?? []).map((p: Record<string, unknown>) => ({
          name: String(p.name ?? 'Untitled Phase'),
          objective: String(p.objective ?? ''),
          sceneAllocation: Number(p.sceneAllocation) || 15,
          constraints: String(p.constraints ?? ''),
          worldExpansionHints: String(p.worldExpansionHints ?? ''),
        })),
      };
    }
  } catch (err) {
    console.error('[generateCustomPlan] JSON parse failed:', err);
  }

  throw new Error('Failed to generate custom plan from document');
}

/**
 * Check if the active planning phase has reached its scene allocation.
 * Returns the phase if complete, null otherwise.
 */
export function checkPhaseCompletion(
  queue: PlanningQueue | undefined,
  newScenesAdded: number,
): PlanningPhase | null {
  if (!queue) return null;
  const active = queue.phases[queue.activePhaseIndex];
  if (!active || active.status !== 'active') return null;

  const updatedCompleted = active.scenesCompleted + newScenesAdded;
  if (updatedCompleted >= active.sceneAllocation) {
    return active;
  }
  return null;
}
