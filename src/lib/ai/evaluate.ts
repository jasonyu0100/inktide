import type { NarrativeState, BranchEvaluation, SceneEval, SceneVerdict, Scene, Arc } from '@/types/narrative';
import { resolveEntry, isScene } from '@/types/narrative';
import { callGenerate, SYSTEM_PROMPT } from './api';
import { parseJson } from './json';
import { ANALYSIS_MODEL } from '@/lib/constants';

/**
 * Evaluate a branch by reading only scene summaries.
 *
 * Produces a per-scene verdict (ok / edit / rewrite / cut) and an overall
 * critique covering structure, pacing, repetition, character arcs, and theme.
 * Designed to be cheap — no prose, no mutations, just summaries + arc names.
 */
export async function evaluateBranch(
  narrative: NarrativeState,
  resolvedKeys: string[],
  branchId: string,
  /** Optional external guidance — e.g. paste from ChatGPT, editor notes, specific focus areas */
  guidance?: string,
): Promise<BranchEvaluation> {
  // Collect scenes with their arc context
  const sceneSummaries: { idx: number; id: string; arc: string; pov: string; location: string; summary: string }[] = [];
  for (let i = 0; i < resolvedKeys.length; i++) {
    const entry = resolveEntry(narrative, resolvedKeys[i]);
    if (!entry || !isScene(entry)) continue;
    const scene = entry as Scene;
    const arc = narrative.arcs[scene.arcId] as Arc | undefined;
    const pov = narrative.characters[scene.povId]?.name ?? scene.povId;
    const location = narrative.locations[scene.locationId]?.name ?? scene.locationId;
    sceneSummaries.push({
      idx: i + 1,
      id: scene.id,
      arc: arc?.name ?? 'standalone',
      pov,
      location,
      summary: scene.summary,
    });
  }

  if (sceneSummaries.length === 0) {
    return {
      id: `EVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: 'No scenes to evaluate.',
      sceneEvals: [],
      repetitions: [],
      thematicQuestion: '',
    };
  }

  // Build a compact scene list — summaries only
  const sceneBlock = sceneSummaries
    .map((s) => `[${s.idx}] ${s.id} | Arc: "${s.arc}" | POV: ${s.pov} | Loc: ${s.location}\n    ${s.summary}`)
    .join('\n');

  // Thread overview for context
  const threads = Object.values(narrative.threads);
  const threadBlock = threads
    .map((t) => `${t.id}: ${t.description} [${t.status}]`)
    .join('\n');

  const guidanceBlock = guidance?.trim()
    ? `

EXTERNAL GUIDANCE — The author or another reviewer has provided the following observations. You MUST incorporate these into your evaluation. Validate each point against the scene summaries. If the guidance identifies specific scenes as problematic, those scenes should be flagged as "edit" or "rewrite" unless you can specifically justify why they are fine. Add your own analysis on top — the guidance is additive, not a replacement for your own judgment.

---
${guidance.trim()}
---`
    : '';

  const prompt = `You are a story editor reviewing a complete branch of a serialized narrative. You have ONLY scene summaries — no prose. Your job is to evaluate structural quality.

TITLE: "${narrative.title}"
DESCRIPTION: ${narrative.description}

THREADS:
${threadBlock}

SCENE SUMMARIES (${sceneSummaries.length} scenes):
${sceneBlock}

${guidanceBlock}

Evaluate this branch on these dimensions:

1. **STRUCTURE** — Does the sequence build? Are arcs well-shaped or do they fizzle?
2. **PACING** — Is there breathing room between high-intensity moments? Any flatlines?
3. **REPETITION** — Are beats, locations, or character reactions repeating? Name the stale patterns.
4. **CHARACTER** — Who changes? Who is stuck in a loop? Who appears but does nothing?
5. **THREADS** — Which threads are advancing well? Which are stagnating or being ignored?
6. **THEME** — What is this story about underneath the plot? Is it interrogating anything?

For EACH scene, assign a verdict. These map to concrete operations — choose carefully:
- "ok" — scene works structurally and respects continuity. No changes needed.
- "edit" — the scene's core is right (correct POV, correct location, correct participants) but the SUMMARY needs tightening. Use for: repetitive beats that need variation, weak event descriptions, minor continuity fixes in what happens, thread mutations that need adjusting. The scene keeps its POV, location, and cast — only summary, events, and mutations change.
- "rewrite" — the scene's STRUCTURE is wrong and needs rebuilding from scratch. Use for: wrong POV character for this moment, wrong location, wrong participants, or continuity broken so badly the scene needs reimagining. Everything changes — POV, location, participants, mutations, summary. NOTE: "rewrite" means THIS SCENE SHOULD EXIST but with different content. Do NOT use "rewrite" for scenes that are redundant — use "cut" instead.
- "cut" — scene is redundant, a near-duplicate of another scene, or adds nothing the narrative needs. The story is tighter without it. USE THIS VERDICT. If a scene covers the same beat as another scene and the other scene does it better, cut this one. If the reason includes words like "redundant", "overlap", "duplicate", "repetitive of S-XXX", or "same beat as" — that is a CUT, not a rewrite.

CONTINUITY IS PARAMOUNT. A scene that contradicts established character knowledge, places a character in the wrong location, ignores the consequences of a prior scene, or leaks information a character shouldn't have yet MUST be flagged as "edit" or "rewrite" — never "ok".

CUTTING IS EXPECTED. A well-edited branch will cut redundant scenes. If two scenes cover the same ground, keep the stronger one and cut the weaker. Do not rewrite a redundant scene into something different — cut it and let the remaining scenes breathe.

Be honest and specific. If the branch is genuinely strong, every scene CAN be "ok" — do not manufacture problems. But if scenes repeat the same beat, break continuity, or add nothing, flag them. Accuracy matters more than finding a quota of issues.

Return JSON:
{
  "overall": "3-5 paragraph honest critique covering what's genuinely working and what's weak. Be specific — name scenes, characters, patterns. End with the thematic question this story needs to answer.",
  "sceneEvals": [
    { "sceneId": "SC-001", "verdict": "ok|edit|rewrite|cut", "reason": "one sentence" }
  ],
  "repetitions": ["pattern 1", "pattern 2"],
  "thematicQuestion": "The human question underneath the plot that the story needs to interrogate"
}

Every scene must appear in sceneEvals. Use the exact scene IDs from above.`;

  // Scale token budget: ~80 tokens per scene for verdicts + ~2000 for overall analysis
  const maxTokens = Math.min(16000, 2000 + sceneSummaries.length * 80);
  const raw = await callGenerate(prompt, SYSTEM_PROMPT, maxTokens, 'evaluateBranch', ANALYSIS_MODEL);

  try {
    const parsed = parseJson(raw, 'evaluateBranch') as {
      overall?: string;
      sceneEvals?: { sceneId?: string; verdict?: string; reason?: string }[];
      repetitions?: string[];
      thematicQuestion?: string;
    };

    const validVerdicts = new Set<SceneVerdict>(['ok', 'edit', 'rewrite', 'cut']);
    const sceneEvals: SceneEval[] = (parsed.sceneEvals ?? [])
      .filter((e) => e.sceneId && narrative.scenes[e.sceneId])
      .map((e) => ({
        sceneId: e.sceneId!,
        verdict: validVerdicts.has(e.verdict as SceneVerdict) ? (e.verdict as SceneVerdict) : 'ok',
        reason: e.reason ?? '',
      }));

    return {
      id: `EVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: parsed.overall ?? 'Evaluation failed to produce analysis.',
      sceneEvals,
      repetitions: parsed.repetitions ?? [],
      thematicQuestion: parsed.thematicQuestion ?? '',
    };
  } catch {
    return {
      id: `EVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: 'Evaluation parse failed. Raw response logged.',
      sceneEvals: sceneSummaries.map((s) => ({ sceneId: s.id, verdict: 'ok' as const, reason: 'Parse failed — defaulted' })),
      repetitions: [],
      thematicQuestion: '',
    };
  }
}
