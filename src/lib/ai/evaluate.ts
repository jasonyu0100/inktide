import type { NarrativeState, BranchEvaluation, ProseEvaluation, ProseSceneEval, SceneEval, SceneVerdict, Scene, Arc } from '@/types/narrative';
import { resolveEntry, isScene, REASONING_BUDGETS } from '@/types/narrative';
import { callGenerate, SYSTEM_PROMPT } from './api';
import { parseJson } from './json';
import { ANALYSIS_MODEL, MAX_TOKENS_DEFAULT } from '@/lib/constants';

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

PRIORITY GUIDANCE FROM THE AUTHOR — These are specific issues the author has identified. You MUST address every point below. For each issue raised, identify the specific scenes affected and flag them as "edit" or "rewrite". Your overall critique MUST discuss these issues. Do not ignore any of them.

${guidance.trim()}`
    : '';

  const prompt = `You are a story editor reviewing a complete branch of a serialized narrative. You have ONLY scene summaries — no prose. Your job is to evaluate structural quality.
${guidanceBlock}

TITLE: "${narrative.title}"
DESCRIPTION: ${narrative.description}

THREADS:
${threadBlock}

SCENE SUMMARIES (${sceneSummaries.length} scenes):
${sceneBlock}

Evaluate this branch on these dimensions:

1. **STRUCTURE** — Does the sequence build? Are arcs well-shaped or do they fizzle?
2. **PACING** — Is there breathing room between high-intensity moments? Any flatlines?
3. **REPETITION** — Are beats, locations, or character reactions repeating? Name the stale patterns.
4. **CHARACTER** — Who changes? Who is stuck in a loop? Who appears but does nothing?
5. **THREADS** — Which threads are advancing well? Which are stagnating or being ignored?
6. **THEME** — What is this story about underneath the plot? Is it interrogating anything?

For EACH scene, assign a verdict. These map to concrete operations:
- "ok" — scene works. No changes needed.
- "edit" — scene should exist but needs revision. You may change ANYTHING: POV, location, participants, summary, events, mutations. Use for: wrong POV for this moment, repetitive beats that need variation, weak execution, continuity breaks, scenes that need restructuring while keeping their place in the timeline.
- "merge" — this scene covers the same beat as another and should be ABSORBED into the stronger one. You MUST specify "mergeInto" with the target scene ID. The two become one denser scene. Use when two scenes advance the same thread with similar dramatic shape.
- "cut" — scene is redundant and adds nothing. The story is tighter without it.
- "defer" — good beat, wrong timing. This scene should be removed from the current arc and carried forward as a priority for the next arc. You MUST specify "deferredBeat" describing what should happen later. Use when a scene introduces something that would land better after other events have played out.

STRUCTURAL OPERATIONS GUIDE:
- If 5 scenes cover the same beat: keep the strongest as "ok", merge 1-2 into it, cut the rest.
- If a thread has 8 scenes but only 3 distinct beats: merge within each beat, cut the remainder.
- If a scene is fine but premature: defer it so the next arc can execute it with proper setup.
- "mergeInto" must reference a scene that is NOT itself cut/merged/deferred.
- Prefer merge over cut when the weaker scene has unique content worth absorbing.

CONTINUITY IS PARAMOUNT. Scenes that contradict established knowledge, misplace characters, or leak information must be flagged — never "ok".

COMPRESSION IS EXPECTED. Most branches benefit from losing 20-40% of their scenes through merges and cuts. Do not preserve scenes out of politeness.

CROSS-SCENE CONSISTENCY — CRITICAL:
All edits are applied in parallel. Each edited scene only sees its own reason — it does NOT see what other scenes are being changed. This means YOU must encode cross-scene continuity into each reason explicitly.

Before writing reasons, mentally map the full set of changes you're proposing and identify causal chains:
1. List every scene getting a non-"ok" verdict.
2. For each such scene, ask: does this change affect something an upstream or downstream scene references? Does it resolve a contradiction that another edit also touches?
3. Write reasons so that each edit is self-sufficient — the scene being edited can be rewritten correctly even without knowing what other scenes look like.

RULES FOR EDIT REASONS:
- If scene A's edit removes, adds, or changes a fact that scene B depends on, scene B's reason MUST say: "Note: [scene A] is being edited to [specific change] — this scene must be consistent with that."
- If two scenes currently contradict each other, decide which edit is authoritative and make the other defer to it explicitly in its reason.
- If a scene is being cut or merged, any surviving scene that referenced it must have a reason that accounts for its removal.
- Edit reasons are instructions to a rewriter who cannot see the rest of the branch. Make them complete.

Return JSON:
{
  "overall": "3-5 paragraph critique. Name scenes, characters, patterns. End with the thematic question.",
  "sceneEvals": [
    { "sceneId": "SC-001", "verdict": "ok|edit|merge|cut|defer", "reason": "For edit: 1-3 sentences that fully instruct the rewriter — include what other scenes are changing if relevant (e.g. 'Note: SC-009 is being edited to remove X, adjust accordingly'). For merge/cut/defer: one sentence.", "mergeInto": "SC-XXX (merge only)", "deferredBeat": "description (defer only)" }
  ],
  "repetitions": ["pattern 1", "pattern 2"],
  "thematicQuestion": "The human question underneath the plot"
}

Every scene must appear in sceneEvals. Use the exact scene IDs from above.${guidance?.trim() ? `\n\nREMINDER — The author specifically asked you to address: "${guidance.trim()}". Your overall critique and scene verdicts MUST reflect this. Any scene affected by this guidance MUST NOT be marked "ok".` : ''}`;

  const maxTokens = MAX_TOKENS_DEFAULT;
  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;
  const raw = await callGenerate(prompt, SYSTEM_PROMPT, maxTokens, 'evaluateBranch', ANALYSIS_MODEL, reasoningBudget);

  try {
    const parsed = parseJson(raw, 'evaluateBranch') as {
      overall?: string;
      sceneEvals?: { sceneId?: string; verdict?: string; reason?: string; mergeInto?: string; deferredBeat?: string }[];
      repetitions?: string[];
      thematicQuestion?: string;
    };

    const validVerdicts = new Set<SceneVerdict>(['ok', 'edit', 'merge', 'cut', 'defer']);
    const sceneEvals: SceneEval[] = (parsed.sceneEvals ?? [])
      .filter((e) => e.sceneId && narrative.scenes[e.sceneId])
      .map((e) => {
        // Accept 'rewrite' from older models and map to 'edit'
        let rawVerdict = e.verdict as string;
        if (rawVerdict === 'rewrite') rawVerdict = 'edit';
        const verdict = validVerdicts.has(rawVerdict as SceneVerdict) ? (rawVerdict as SceneVerdict) : 'ok';
        const eval_: SceneEval = { sceneId: e.sceneId!, verdict, reason: e.reason ?? '' };
        if (verdict === 'merge') {
          // Validate merge target: must exist AND not itself be cut/merged/deferred
          const targetEval = parsed.sceneEvals?.find((t) => t.sceneId === e.mergeInto);
          const targetVerdict = targetEval?.verdict;
          const targetInvalid = !e.mergeInto || !narrative.scenes[e.mergeInto]
            || targetVerdict === 'cut' || targetVerdict === 'merge' || targetVerdict === 'defer';
          if (targetInvalid) {
            eval_.verdict = 'cut';
            eval_.reason = `${eval_.reason} (merge target invalid or also removed, converted to cut)`;
          } else {
            eval_.mergeInto = e.mergeInto;
          }
        }
        if (verdict === 'defer') {
          eval_.deferredBeat = e.deferredBeat ?? eval_.reason;
        }
        return eval_;
      });

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

// ── Prose Quality Evaluation ─────────────────────────────────────────────────

export async function evaluateProseQuality(
  narrative: NarrativeState,
  resolvedKeys: string[],
  branchId: string,
  guidance?: string,
): Promise<ProseEvaluation> {
  // Collect scenes that have prose
  const scenesWithProse: { id: string; pov: string; location: string; summary: string; prose: string; wordCount: number }[] = [];
  for (const key of resolvedKeys) {
    const entry = resolveEntry(narrative, key);
    if (!entry || !isScene(entry)) continue;
    const scene = entry as Scene;
    if (!scene.prose) continue;
    scenesWithProse.push({
      id: scene.id,
      pov: narrative.characters[scene.povId]?.name ?? scene.povId,
      location: narrative.locations[scene.locationId]?.name ?? scene.locationId,
      summary: scene.summary,
      prose: scene.prose,
      wordCount: scene.prose.split(/\s+/).length,
    });
  }

  if (scenesWithProse.length === 0) {
    return {
      id: `PEVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: 'No scenes with prose to evaluate.',
      sceneEvals: [],
      patterns: [],
    };
  }

  // Build prose profile context
  const profile = narrative.proseProfile;
  const profileBlock = profile
    ? `PROSE PROFILE (the prose should conform to this voice):
Register: ${profile.register} | Stance: ${profile.stance}${profile.tense ? ` | Tense: ${profile.tense}` : ''}${profile.sentenceRhythm ? ` | Rhythm: ${profile.sentenceRhythm}` : ''}${profile.interiority ? ` | Interiority: ${profile.interiority}` : ''}${profile.dialogueWeight ? ` | Dialogue: ${profile.dialogueWeight}` : ''}
${profile.devices?.length ? `Devices: ${profile.devices.join(', ')}` : ''}
${profile.rules?.length ? `Rules:\n${profile.rules.map((r) => `  - ${r}`).join('\n')}` : ''}${profile.antiPatterns?.length ? `\nAnti-patterns (flag violations):\n${profile.antiPatterns.map((a) => `  ✗ ${a}`).join('\n')}` : ''}`
    : '';

  const guidanceBlock = guidance?.trim()
    ? `\nPRIORITY GUIDANCE FROM THE AUTHOR — You MUST address every point below. For each issue raised, identify the specific scenes affected and flag them as "edit".\n\n${guidance.trim()}`
    : '';

  // Build scene blocks with prose
  const sceneBlocks = scenesWithProse.map((s) =>
    `[${s.id}] POV: ${s.pov} | Loc: ${s.location} | ${s.wordCount} words\nSummary: ${s.summary}\n---\n${s.prose}\n---`
  ).join('\n\n');

  const prompt = `You are a prose editor reviewing the actual written prose of a serialized narrative. You have both summaries and full prose text. Evaluate prose QUALITY — not plot structure.
${guidanceBlock}
${profileBlock ? `\n${profileBlock}\n` : ''}
TITLE: "${narrative.title}"

SCENES WITH PROSE (${scenesWithProse.length} scenes):
${sceneBlocks}

Evaluate the prose on these dimensions:

1. **VOICE CONSISTENCY** — Does the prose match the prose profile? Is the register, rhythm, and interiority consistent?
2. **CRAFT** — Sentence quality, word choice, show-don't-tell, dialogue naturalism, sensory grounding
3. **PACING** — Within-scene pacing. Are beats rushed or drawn out? Does the prose breathe?
4. **CONTINUITY** — Does the prose contradict established facts, character positions, or knowledge?
5. **REPETITION** — Repeated phrases, images, sentence structures, or verbal tics across scenes
6. **PROFILE COMPLIANCE** — If a prose profile is provided, does the prose follow its rules?

For EACH scene, assign a verdict:
- "ok" — prose is strong, no changes needed
- "edit" — prose needs revision. List specific, actionable issues.

Be specific in your issues. Not "dialogue feels off" but "Fang Yuan speaks in elaborate metaphors in lines 3-5, violating the 'plain, forgettable language' rule."

Return JSON:
{
  "overall": "2-4 paragraph prose quality critique. Name specific scenes and quote specific lines.",
  "sceneEvals": [
    { "sceneId": "S-001", "verdict": "ok|edit", "issues": ["specific issue 1", "specific issue 2"] }
  ],
  "patterns": ["recurring prose issue 1", "recurring prose issue 2"]
}

Every scene with prose must appear in sceneEvals. Use the exact scene IDs.${guidance?.trim() ? `\n\nREMINDER — The author specifically asked you to address: "${guidance.trim()}". Your overall critique and scene verdicts MUST reflect this.` : ''}`;

  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;
  const raw = await callGenerate(prompt, SYSTEM_PROMPT, MAX_TOKENS_DEFAULT, 'evaluateProseQuality', ANALYSIS_MODEL, reasoningBudget);

  try {
    const parsed = parseJson(raw, 'evaluateProseQuality') as {
      overall?: string;
      sceneEvals?: { sceneId?: string; verdict?: string; issues?: string[] }[];
      patterns?: string[];
    };

    const sceneEvals: ProseSceneEval[] = (parsed.sceneEvals ?? [])
      .filter((e) => e.sceneId && scenesWithProse.some((s) => s.id === e.sceneId))
      .map((e) => ({
        sceneId: e.sceneId!,
        verdict: (e.verdict === 'edit' ? 'edit' : 'ok') as ProseSceneEval['verdict'],
        issues: Array.isArray(e.issues) ? e.issues.filter((i): i is string => typeof i === 'string') : [],
      }));

    return {
      id: `PEVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: parsed.overall ?? 'Evaluation failed to produce analysis.',
      sceneEvals,
      patterns: parsed.patterns ?? [],
    };
  } catch {
    return {
      id: `PEVAL-${Date.now().toString(36)}`,
      branchId,
      createdAt: new Date().toISOString(),
      overall: 'Prose evaluation parse failed. Raw response logged.',
      sceneEvals: scenesWithProse.map((s) => ({ sceneId: s.id, verdict: 'ok' as const, issues: ['Parse failed — defaulted'] })),
      patterns: [],
    };
  }
}
