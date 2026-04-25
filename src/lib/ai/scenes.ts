import type { NarrativeState, Scene, Arc, WorldBuild, StorySettings, Beat, BeatPlan, BeatProse, BeatProseMap, Proposition, ThreadLogNodeType, SystemNode, Thread, Artifact, Character, Location as LocationEntity, LocationProminence } from '@/types/narrative';
import { DEFAULT_STORY_SETTINGS, REASONING_BUDGETS, BEAT_FN_LIST, BEAT_MECHANISM_LIST, NARRATOR_AGENT_ID } from '@/types/narrative';
import { isThreadAbandoned, isThreadClosed, clampEvidence, FORCE_BANDS, fmtBand } from '@/lib/narrative-utils';
import { nextId, nextIds } from '@/lib/narrative-utils';
import { newNarratorBelief } from '@/lib/thread-log';
import { normalizeTimeDelta } from '@/lib/time-deltas';
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from './api';
import { WRITING_MODEL, GENERATE_MODEL, MAX_TOKENS_LARGE, MAX_TOKENS_DEFAULT, MAX_TOKENS_SMALL, WORDS_PER_BEAT, ANALYSIS_TEMPERATURE } from '@/lib/constants';
import { parseJson } from './json';
import { narrativeContext, sceneContext, buildProseProfile } from './context';
import { PROMPT_STRUCTURAL_RULES, PROMPT_DELTAS, PROMPT_ARTIFACTS, PROMPT_LOCATIONS, PROMPT_POV, PROMPT_WORLD, PROMPT_SUMMARY_REQUIREMENT, promptThreadLifecycle, buildThreadHealthPrompt, buildCompletedBeatsPrompt, PROMPT_FORCE_STANDARDS, PROMPT_ARC_STATE_GUIDANCE, buildScenePlanSystemPrompt, buildBeatAnalystSystemPrompt, buildScenePlanEditSystemPrompt, buildSceneProseSystemPrompt } from './prompts';
import { samplePacingSequence, buildSequencePrompt, detectCurrentMode, MATRIX_PRESETS, DEFAULT_TRANSITION_MATRIX, type PacingSequence } from '@/lib/pacing-profile';
import { resolveProfile, resolveSampler, sampleBeatSequence } from '@/lib/beat-profiles';
import { FORMAT_INSTRUCTIONS } from '@/lib/prompts';
import { logWarning, logError, logInfo } from '@/lib/system-logger';
import type { ReasoningGraph } from './reasoning-graph';
import { buildSequentialPath, extractPatternWarningDirectives } from './reasoning-graph';
import { retryWithValidation, validateBeatPlan, validateBeatProseMap } from './validation';
import { sanitizeSystemDelta, systemEdgeKey, makeSystemIdAllocator, resolveSystemConceptIds } from '@/lib/system-graph';

/**
 * Split text into sentences, handling edge cases like abbreviations, decimals, and ellipsis.
 * More reliable than simple regex splitting.
 */
function splitIntoSentences(text: string): string[] {
  // Common abbreviations that shouldn't trigger sentence breaks
  const abbreviations = new Set([
    'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
    'Fig', 'Eq', 'Vol', 'No', 'Ch', 'Sec', 'vs',
    'etc', 'i.e', 'e.g', 'al', 'et'
  ]);

  const sentences: string[] = [];
  let currentSentence = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    currentSentence += char;

    // Check for sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      // Look ahead for additional punctuation or ellipsis
      let j = i + 1;
      while (j < text.length && (text[j] === '.' || text[j] === '!' || text[j] === '?')) {
        currentSentence += text[j];
        j++;
      }

      // Skip closing quotes/parentheses
      while (j < text.length && (text[j] === '"' || text[j] === "'" || text[j] === ')' || text[j] === ']')) {
        currentSentence += text[j];
        j++;
      }

      // Check if this is a sentence boundary
      let isSentenceBoundary = false;

      // If followed by whitespace + capital letter or end of text, likely a boundary
      if (j >= text.length) {
        isSentenceBoundary = true;
      } else if (j < text.length && /\s/.test(text[j])) {
        // Skip whitespace
        let k = j;
        while (k < text.length && /\s/.test(text[k])) {
          k++;
        }
        // Check if next non-whitespace is capital letter or quote + capital
        if (k < text.length) {
          const nextChar = text[k];
          const isCapital = /[A-Z]/.test(nextChar);
          const isQuoteBeforeCapital = (nextChar === '"' || nextChar === "'") && k + 1 < text.length && /[A-Z]/.test(text[k + 1]);

          if (isCapital || isQuoteBeforeCapital) {
            // Check for abbreviations and decimals
            const words = currentSentence.trim().split(/\s+/);
            const lastWord = words[words.length - 1];
            const wordWithoutPunct = lastWord.replace(/[.!?]+$/, '');

            // Check if it's a decimal number like "1.2"
            const isDecimal = /^\d+\.\d*$/.test(lastWord);
            if (isDecimal) {
              // Don't split on decimal numbers
            } else if (abbreviations.has(wordWithoutPunct)) {
              // It's an abbreviation, but check if it's truly the end of a sentence
              // by looking at the next word
              let nextWordStart = k;
              if (nextChar === '"' || nextChar === "'") {
                nextWordStart = k + 1;
              }
              // Extract the next word
              let nextWordEnd = nextWordStart;
              while (nextWordEnd < text.length && /[A-Za-z]/.test(text[nextWordEnd])) {
                nextWordEnd++;
              }
              const nextWord = text.substring(nextWordStart, nextWordEnd);

              // Common sentence starters that indicate a new sentence despite abbreviation
              const sentenceStarters = new Set([
                'The', 'A', 'An', 'He', 'She', 'It', 'They', 'We', 'I', 'You',
                'This', 'That', 'These', 'Those', 'His', 'Her', 'Their', 'My', 'Our',
                'But', 'And', 'Or', 'So', 'Yet', 'For', 'Nor', 'As', 'If', 'When',
                'Where', 'Why', 'How', 'What', 'Who', 'Which'
              ]);

              if (sentenceStarters.has(nextWord)) {
                isSentenceBoundary = true;
              }
            } else {
              // Not an abbreviation or decimal, so it's a sentence boundary
              isSentenceBoundary = true;
            }
          }
        }
      }

      if (isSentenceBoundary) {
        // Add whitespace that follows
        while (j < text.length && /\s/.test(text[j])) {
          currentSentence += text[j];
          j++;
        }
        sentences.push(currentSentence.trim());
        currentSentence = '';
        i = j - 1; // Will be incremented at end of loop
      } else {
        i = j - 1;
      }
    }

    i++;
  }

  // Add any remaining text
  if (currentSentence.trim()) {
    sentences.push(currentSentence.trim());
  }

  return sentences;
}

/** Parse raw proposition data into Proposition objects with free-form type labels */
function parsePropositions(rawProps: unknown[]): Proposition[] {
  return rawProps
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => {
      const prop: Proposition = { content: String(p.content ?? '') };
      const rawType = typeof p.type === 'string' && p.type.trim() ? p.type.trim() : undefined;
      if (rawType) prop.type = rawType;
      return prop;
    })
    .filter((p) => p.content.length > 0);
}

/** Context from an active coordination plan, injected directly into generation. */
export type CoordinationPlanContext = {
  /** Current arc index (1-based) */
  arcIndex: number;
  /** Total arc count in the plan */
  arcCount: number;
  /** Arc label from the plan */
  arcLabel: string;
  /** Scene count for this arc */
  sceneCount: number;
  /** Force mode for this arc (e.g., 'fate', 'world', 'system') */
  forceMode?: string;
  /** Full directive built from the plan's reasoning graph */
  directive: string;
};

export type GenerateScenesOptions = {
  existingArc?: Arc;
  /** Pre-sampled pacing sequence. When omitted, one is auto-sampled from the story's transition matrix. */
  pacingSequence?: PacingSequence;
  worldBuildFocus?: WorldBuild;
  /** Reasoning graph that guides scene generation. When provided, replaces direction with structured reasoning path. */
  reasoningGraph?: ReasoningGraph;
  /** Coordination plan context. When provided, injects plan guidance into generation. */
  coordinationPlanContext?: CoordinationPlanContext;
  onToken?: (token: string) => void;
  /** Callback for streaming reasoning/thinking tokens */
  onReasoning?: (token: string) => void;
  /** When true, skip extended reasoning even if story settings enable it */
  disableReasoning?: boolean;
};

export async function generateScenes(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  count: number,
  direction: string,
  options: GenerateScenesOptions = {},
): Promise<{ scenes: Scene[]; arc: Arc }> {
  const { existingArc, pacingSequence, worldBuildFocus, reasoningGraph, coordinationPlanContext, onToken, onReasoning } = options;
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);
  const arcId = existingArc?.id ?? nextId('ARC', Object.keys(narrative.arcs));

  logInfo('Starting scene generation', {
    source: 'manual-generation',
    operation: 'generate-scenes',
    details: {
      narrativeId: narrative.id,
      arcId,
      sceneCount: count,
      existingArc: !!existingArc,
      hasPacingSequence: !!pacingSequence,
      hasWorldBuildFocus: !!worldBuildFocus,
    },
  });
  const storySettings: StorySettings = { ...DEFAULT_STORY_SETTINGS, ...narrative.storySettings };
  const targetLen = storySettings.targetArcLength;
  const sceneCountInstruction = count > 0
    ? `exactly ${count} scenes`
    : `${Math.max(2, targetLen - 1)}-${targetLen + 1} scenes (choose the count that best fits the arc's natural length)`;
  const arcInstruction = existingArc
    ? `CONTINUE the existing arc "${existingArc.name}" (${arcId}) which already has ${existingArc.sceneIds.length} scenes. Add ${sceneCountInstruction} that naturally extend this arc.`
    : `Generate a NEW ARC with ${sceneCountInstruction}. Give the arc a short, evocative name (2-4 words) that reads like a chapter title — specific to the story, not generic.`;
  // Unique seed to ensure divergent narrative directions across parallel generations
  const seed = Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);

  // ── Pacing sequence: sample from Markov chain when enabled ──
  const sceneCount = count > 0 ? Math.max(4, count) : targetLen;
  let sequencePrompt = '';
  let sequence: PacingSequence | null = null;
  if (storySettings.usePacingChain !== false) {
    if (pacingSequence) {
      sequence = pacingSequence;
    } else {
      const currentMode = detectCurrentMode(narrative, resolvedKeys);
      const matrix = MATRIX_PRESETS.find((p) => p.key === storySettings.rhythmPreset)?.matrix
        ?? DEFAULT_TRANSITION_MATRIX;
      sequence = samplePacingSequence(currentMode, sceneCount, matrix);
    }
    sequencePrompt = buildSequencePrompt(sequence);
  }

  const prompt = `${ctx}

NARRATIVE SEED: ${seed}

${arcInstruction}
${reasoningGraph ? `REASONING GRAPH — PRIMARY BRIEF. Execute this path exactly; don't skip nodes or invent reasoning not shown.

Arc Summary: ${reasoningGraph.summary}

REASONING PATH:
${buildSequentialPath(reasoningGraph)}
${(() => {
  const directives = extractPatternWarningDirectives(reasoningGraph);
  return directives ? `\n## COURSE-CORRECTION DIRECTIVES\n\n${directives}\n` : "";
})()}
REASONING: nodes are core logic to execute. CHARACTER/LOCATION/ARTIFACT/SYSTEM: nodes provide grounding. OUTCOME: nodes are thread effects to deliver. Edge labels carry meaning (enables, requires, causes, etc.).` : coordinationPlanContext ? `COORDINATION PLAN — PRIMARY BRIEF (Arc ${coordinationPlanContext.arcIndex}/${coordinationPlanContext.arcCount}: "${coordinationPlanContext.arcLabel}"). Directive derived from backward-induction across the full plan.
${coordinationPlanContext.forceMode ? `Force Mode: ${coordinationPlanContext.forceMode.toUpperCase()}.` : ''}

${coordinationPlanContext.directive}${direction.trim() ? `\n\nADDITIONAL DIRECTION (layer on top):\n${direction}` : ''}` : direction.trim() ? `DIRECTION — PRIMARY BRIEF. Every scene executes these beats. Prose-level guidance (tone, POV style, pacing, register) must flow into the scene summaries — the summary is the prose writer's only brief.

${direction}` : 'DIRECTION: Use your judgment — pick the most compelling next development based on unresolved threads, tensions, and momentum.'}
${worldBuildFocus ? (() => {
  const wb = worldBuildFocus;
  const chars = wb.expansionManifest.newCharacters.map((c) => `${c.name} (${c.role})`);
  const locs = wb.expansionManifest.newLocations.map((l) => l.name);
  const threads = wb.expansionManifest.newThreads.map((t) => {
    const live = narrative.threads[t.id];
    const status = live
      ? (isThreadClosed(live) ? 'closed' : isThreadAbandoned(live) ? 'abandoned' : 'open')
      : 'open';
    const outcomes = (live?.outcomes ?? t.outcomes ?? []).join(' | ');
    return `${t.description} [${status}] outcomes: ${outcomes}`;
  });
  const lines: string[] = [`WORLD BUILD FOCUS (${wb.id} — "${wb.summary}"): The entities below were recently introduced and have not yet had a presence in the story. This arc should bring them in — use these characters in scenes, set at least one scene in these locations, and begin seeding these latent threads:`];
  if (chars.length) lines.push(`  Characters: ${chars.join(', ')}`);
  if (locs.length) lines.push(`  Locations: ${locs.join(', ')}`);
  if (threads.length) lines.push(`  Threads to activate: ${threads.join('; ')}`);
  return '\n' + lines.join('\n') + '\n';
})() : ''}
The scenes must continue from the current point in the story (after scene index ${currentIndex + 1}).

${sequencePrompt}

Return JSON with this exact structure.

PROCEDURE per scene:
  1. DRAFT the summary in rich prose using NAMES not IDs.
  2. ENUMERATE per sentence: which entity changed, which rule surfaced, which thread moved, which off-screen party would receive news. Usually multiple answers.
  3. REWRITE the summary so every intended delta has a source sentence. Summary and delta-set are paired.
  4. EMIT the full delta block.
The summary is your DELTA BUDGET — richer summary supports richer extraction. Under-tagging is the dominant failure.

{
  "arcName": "2-4 words, evocative, UNIQUE. Bad: 'Continuation'. Good: 'Fractured Oaths'.",
  "directionVector": "Forward-looking intent for this arc.",
  "worldState": "Compact state snapshot at END of arc — the chess-board position.",
  "scenes": [
    {
      "id": "S-GEN-001",
      "arcId": "${arcId}",
      "locationId": "existing location ID",
      "povId": "character ID (must be a participant)${storySettings.povMode !== 'free' && storySettings.povCharacterIds.length > 0 ? ` — RESTRICTED: ${storySettings.povCharacterIds.join(', ')}` : storySettings.povMode === 'free' && storySettings.povCharacterIds.length > 0 ? ` — PREFER: ${storySettings.povCharacterIds.join(', ')}` : ''}",
      "participantIds": ["existing character IDs"],
      "summary": "3-6 sentences in prose using NAMES not IDs. Write what HAPPENED / was SAID / visibly CHANGED. Include concrete specifics (objects, dialogue, data). No generic summaries, no sentences that end in private emotions.",
      "timeDelta": {"value": 1, "unit": "minute|hour|day|week|month|year"},
      "artifactUsages": [{"artifactId": "A-XX", "characterId": "C-XX", "usage": "what the artifact did"}],
      "characterMovements": {"C-XX": {"locationId": "L-YY", "transition": "how they travelled"}},
      "events": ["event_tag_1", "event_tag_2"],
      "threadDeltas": [{"threadId": "T-XX", "logType": "pulse|transition|setup|escalation|payoff|twist|callback|resistance|stall", "updates": [{"outcome": "outcome name from thread.outcomes", "evidence": -4..+4 (decimals allowed, e.g. +1.5)}], "volumeDelta": 0..2, "addOutcomes": ["optional — new outcome names when this scene structurally opens a possibility not previously in the market"], "rationale": "the summary sentence that moved this thread's market in this scene"}],
      "worldDeltas": [{"entityId": "C-XX|L-XX|A-XX", "addedNodes": [{"id": "K-GEN-001", "content": "15-25 words, present tense", "type": "trait|state|history|capability|belief|relation|secret|goal|weakness"}]}],
      "relationshipDeltas": [{"from": "C-XX", "to": "C-YY", "type": "description", "valenceDelta": 0.1}],
      "systemDeltas": {"addedNodes": [{"id": "SYS-GEN-001", "concept": "15-25 words, general rule, no specific entities/events", "type": "principle|system|concept|tension|event|structure|environment|convention|constraint"}], "addedEdges": [{"from": "SYS-GEN-001", "to": "SYS-XX", "relation": "enables|governs|opposes|extends|created_by|constrains|exist_within"}]},
      "ownershipDeltas": [{"artifactId": "A-XX", "fromId": "C-XX|L-XX|null", "toId": "C-YY|L-YY|null"}],
      "tieDeltas": [{"locationId": "L-XX", "characterId": "C-XX", "action": "add|remove"}],
      "newCharacters": [{"id": "C-GEN-001", "name": "Full Name", "role": "anchor|recurring|transient", "threadIds": [], "imagePrompt": "literal physical description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|history|capability|secret|goal", "content": "key fact"}}, "edges": []}}],
      "newLocations": [{"id": "L-GEN-001", "name": "Name", "prominence": "domain|place|margin", "parentId": "L-XX|null", "tiedCharacterIds": [], "threadIds": [], "imagePrompt": "literal visual description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|history", "content": "key fact"}}, "edges": []}}],
      "newArtifacts": [{"id": "A-GEN-001", "name": "Name", "significance": "key|notable|minor", "parentId": "C-XX|L-XX|null", "threadIds": [], "imagePrompt": "literal visual description", "world": {"nodes": {"K-GEN-XXX": {"id": "K-GEN-XXX", "type": "trait|capability|history|state", "content": "one fact per node"}}, "edges": []}}],
      "newThreads": [{"id": "T-GEN-001", "description": "compelling question", "outcomes": ["yes", "no"], "participants": [{"id": "C-XX", "type": "character|location|artifact"}], "threadLog": {"nodes": {}, "edges": []}}]
    }
  ]
}

INTRODUCE NEW ENTITIES liberally on the fly when the scene needs them (a messenger, a tavern, a letter, a new rivalry). Each new character/location/artifact needs ≥1 world node at creation; each new thread needs ≥1 setup log entry.

NAMING DISCIPLINE — new entities MUST use concrete, in-world proper names. The reasoning graph may seed roles or archetypes ("the betrayer", "Shadow Seeker", "the rival sect"); scene generation is the layer that COLLAPSES those into real names that fit the established culture and naming conventions of the existing cast.
  BAD (placeholder / archetype / role-as-name): "Shadow Seeker", "The Stranger", "Mysterious Figure", "Old Man", "The Rival", "Dark Forest", "Mystery Letter".
  GOOD (concrete proper names matching the world): for a Chinese xianxia world — "Liang Wei", "Elder Hua Jin", "Black Pine Ridge", "Letter from Bao Cheng"; for a Tolkien-style setting — "Aerin son of Faldor", "Dunwood Vale".
  RULE: read the existing characters/locations/artifacts in context, match their naming style (length, language family, honorific conventions), and pick a name that could pass as one of theirs. Descriptive labels and titles belong in the world-node content, never in the \`name\` field.

IDS: scene S-GEN-###, knowledge K-GEN-###, system SYS-GEN-### (reused SYS nodes keep original ID), character/location/artifact/thread GEN-### placeholders remapped to real IDs downstream.

TIME DELTA: gap from prior scene as an estimate ({value: int≥0, unit}). "that evening" → 3 hours; "next morning" → 1 day; "three years later" → 3 years. {value:0, unit:"minute"} = simultaneous/concurrent (use for first scene too). Relative only — no absolute calendar.

TAG-RICHLY DISCIPLINE (floors and emission rules consolidated — forces.ts has formulas, deltas.ts has shape):
  FLOORS: ≥6 world nodes across ≥3 entities, ≥1 system node per scene. Never emit \`systemDeltas: {}\`. One threadDelta per thread per scene; transitions move ONE step forward.
  TYPICAL scene: ${fmtBand(FORCE_BANDS.world.typical)} world, ${fmtBand(FORCE_BANDS.system.typical)} system, 2-4 thread pulses (0-1 transitions). CLIMAX: ${fmtBand(FORCE_BANDS.world.climax, true)} world, ${fmtBand(FORCE_BANDS.system.climax)} system, 1-2 transitions. QUIET: ${fmtBand(FORCE_BANDS.world.quiet)} world, ${fmtBand(FORCE_BANDS.system.quiet)} system, 0-1 pulses.
  REFLECTIVE POV (solo-POV scenes, mostly thinking/planning): the POV is STILL the most-changed entity. Expect 4-6 nodes on the POV alone (belief/state/goal/capability/secret shifts), plus 2-3 on adjacent entities (location witnessed, artifact handled, off-screen party affected). A reflective scene with only one POV delta is broken.
  AGENCY over ORBIT, OFF-SCREEN deltas are valid (news/rumour/intelligence), REUSE existing node IDs — only NEW concepts count.

WORKED EXAMPLE — same summary, thin vs rich:

Summary: "Fang Yuan activated Heaven's Mandate Gu on a corpus combining the stone slab's hum with Elder Xuan's Tracking Gu signature. The reading revealed Heaven's Will was embedded within the refinement of specialized Gu — overturning his prior model and demanding a new counter-strategy."

THIN (what to AVOID): 1 worldDelta on Fang Yuan, \`systemDeltas: {}\`.

RICH (target — 8 world across 5 entities + 2 system):
  worldDeltas: [
    {entityId: C-THE-01, nodes: [belief "Heaven's Will embeds inside specialized Gu mechanisms", state "prior external-force model is overturned", goal "shift to proactive counter-mandate engineering", capability "can compose multi-source anomaly corpora"]},
    {entityId: A-THE-04, nodes: [capability "Heaven's Mandate Gu resolves composite corpora into multi-layered revelations"]},
    {entityId: A-18, nodes: [trait "Tracking Gu carries Heaven's Will signature embedded at refinement"]},
    {entityId: A-THE-17, nodes: [trait "stone slab hum carries cosmic-disruption data readable by Mandate Gu"]},
    {entityId: L-THE-03, nodes: [history "Gray Wolf Ranges stronghold served as the analysis site"]}
  ]
  systemDeltas: { addedNodes: [principle "Heaven's Will operates by embedding influence within specialized Gu refinement", concept "Heaven's Mandate Gu resolves anomaly corpora into patterned revelations"], addedEdges: [governs(principle, concept)] }
  threadDeltas: [one transition + optional pulse on the Heaven's Will inquiry thread]

Same summary; the difference is extraction discipline. Apply the rich pattern to every scene.
${PROMPT_STRUCTURAL_RULES}
${PROMPT_SUMMARY_REQUIREMENT}
${PROMPT_FORCE_STANDARDS}
${PROMPT_DELTAS}
${PROMPT_LOCATIONS}
${Object.keys(narrative.artifacts ?? {}).length > 0 ? PROMPT_ARTIFACTS : ''}
${PROMPT_POV}
${PROMPT_WORLD}
${PROMPT_ARC_STATE_GUIDANCE}
${promptThreadLifecycle()}
${buildThreadHealthPrompt(narrative, resolvedKeys, currentIndex)}
${buildCompletedBeatsPrompt(narrative, resolvedKeys, currentIndex)}`;

  // Retry on JSON parse failures (truncation, malformed output)
  const MAX_RETRIES = 2;
  let parsed: { arcName?: string; directionVector?: string; worldState?: string; scenes: Scene[] };
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const reasoningBudget = REASONING_BUDGETS[storySettings.reasoningLevel] || undefined;
      const useStream = !!(onToken || onReasoning);
      const raw = useStream
        ? await callGenerateStream(prompt, SYSTEM_PROMPT, onToken ?? (() => {}), MAX_TOKENS_LARGE, 'generateScenes', GENERATE_MODEL, reasoningBudget, onReasoning)
        : await callGenerate(prompt, SYSTEM_PROMPT, MAX_TOKENS_LARGE, 'generateScenes', GENERATE_MODEL, reasoningBudget);
      parsed = parseJson(raw, 'generateScenes') as { arcName?: string; directionVector?: string; worldState?: string; scenes: Scene[] };
      break;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        logWarning(`Scene generation attempt ${attempt + 1} failed, retrying`, err, {
          source: 'manual-generation',
          operation: 'generate-scenes',
          details: { attempt: attempt + 1, maxRetries: MAX_RETRIES }
        });
      }
    }
  }
  if (!parsed!) throw lastErr;
  const arcName = existingArc?.name ?? parsed.arcName ?? 'Untitled Arc';
  const directionVector = parsed.directionVector;
  const worldState = parsed.worldState;

  const sceneIds = nextIds('S', Object.keys(narrative.scenes), parsed.scenes.length, 3);
  const scenes: Scene[] = parsed.scenes.map((s, i) => ({
    ...s,
    kind: 'scene' as const,
    id: sceneIds[i],
    arcId,
    summary: s.summary || `Scene ${i + 1} of arc "${arcName}"`,
    timeDelta: normalizeTimeDelta(s.timeDelta),
  }));

  sanitizeScenes(scenes, narrative, 'generateScenes');

  // Allocate real IDs for introduced entities (C-GEN-* → C-XX, etc.)
  // Collect all introduced entities across scenes and assign sequential IDs
  const allNewChars = scenes.flatMap((s) => s.newCharacters ?? []);
  const allNewLocs = scenes.flatMap((s) => s.newLocations ?? []);
  const allNewArts = scenes.flatMap((s) => s.newArtifacts ?? []);
  const allNewThreads = scenes.flatMap((s) => s.newThreads ?? []);

  const charIdMap: Record<string, string> = {};
  const locIdMap: Record<string, string> = {};
  const artIdMap: Record<string, string> = {};
  const threadIdMap: Record<string, string> = {};

  if (allNewChars.length > 0) {
    const realCharIds = nextIds('C', Object.keys(narrative.characters), allNewChars.length);
    allNewChars.forEach((c, i) => {
      charIdMap[c.id] = realCharIds[i];
      c.id = realCharIds[i];
    });
  }
  if (allNewLocs.length > 0) {
    const realLocIds = nextIds('L', Object.keys(narrative.locations), allNewLocs.length);
    allNewLocs.forEach((l, i) => {
      locIdMap[l.id] = realLocIds[i];
      l.id = realLocIds[i];
      // Remap parentId if it references another new location
      if (l.parentId && locIdMap[l.parentId]) {
        l.parentId = locIdMap[l.parentId];
      }
    });
  }
  if (allNewArts.length > 0) {
    const realArtIds = nextIds('A', Object.keys(narrative.artifacts ?? {}), allNewArts.length);
    allNewArts.forEach((a, i) => {
      artIdMap[a.id] = realArtIds[i];
      a.id = realArtIds[i];
    });
  }
  if (allNewThreads.length > 0) {
    const realThreadIds = nextIds('T', Object.keys(narrative.threads), allNewThreads.length);
    allNewThreads.forEach((t, i) => {
      threadIdMap[t.id] = realThreadIds[i];
      t.id = realThreadIds[i];
    });
  }

  // Remap references in scenes to use real IDs
  for (const scene of scenes) {
    // Remap participant IDs, POV, location
    scene.participantIds = scene.participantIds.map((id) => charIdMap[id] ?? id);
    scene.povId = charIdMap[scene.povId] ?? scene.povId;
    scene.locationId = locIdMap[scene.locationId] ?? scene.locationId;
    // Remap worldDeltas entity IDs
    for (const km of scene.worldDeltas ?? []) {
      km.entityId = charIdMap[km.entityId] ?? locIdMap[km.entityId] ?? artIdMap[km.entityId] ?? km.entityId;
    }
    // Remap threadDeltas thread IDs
    for (const tm of scene.threadDeltas ?? []) {
      tm.threadId = threadIdMap[tm.threadId] ?? tm.threadId;
    }
    // Remap relationshipDeltas character IDs
    for (const rm of scene.relationshipDeltas ?? []) {
      rm.from = charIdMap[rm.from] ?? rm.from;
      rm.to = charIdMap[rm.to] ?? rm.to;
    }
    // Remap artifact usages
    for (const au of scene.artifactUsages ?? []) {
      au.artifactId = artIdMap[au.artifactId] ?? au.artifactId;
      if (au.characterId) au.characterId = charIdMap[au.characterId] ?? au.characterId;
    }
    // Remap ownership deltas
    for (const om of scene.ownershipDeltas ?? []) {
      om.artifactId = artIdMap[om.artifactId] ?? om.artifactId;
      om.fromId = charIdMap[om.fromId] ?? locIdMap[om.fromId] ?? om.fromId;
      om.toId = charIdMap[om.toId] ?? locIdMap[om.toId] ?? om.toId;
    }
    // Remap tie deltas
    for (const td of scene.tieDeltas ?? []) {
      td.locationId = locIdMap[td.locationId] ?? td.locationId;
      td.characterId = charIdMap[td.characterId] ?? td.characterId;
    }
    // Remap character movements
    if (scene.characterMovements) {
      const remapped: typeof scene.characterMovements = {};
      for (const [charId, mv] of Object.entries(scene.characterMovements)) {
        const newCharId = charIdMap[charId] ?? charId;
        remapped[newCharId] = {
          ...mv,
          locationId: locIdMap[mv.locationId] ?? mv.locationId,
        };
      }
      scene.characterMovements = remapped;
    }
    // Remap tiedCharacterIds in new locations
    for (const l of scene.newLocations ?? []) {
      l.tiedCharacterIds = l.tiedCharacterIds.map((id) => charIdMap[id] ?? id);
    }
    // Remap thread participants
    for (const t of scene.newThreads ?? []) {
      t.participants = t.participants.map((p) => ({
        ...p,
        id: charIdMap[p.id] ?? locIdMap[p.id] ?? artIdMap[p.id] ?? p.id,
      }));
    }
  }

  // Fix world node IDs to be unique and sequential
  // Include both existing entities and newly introduced entities' world nodes
  const existingKIds = [
    ...Object.values(narrative.characters).flatMap((c) => Object.keys(c.world.nodes)),
    ...Object.values(narrative.locations).flatMap((l) => Object.keys(l.world.nodes)),
    ...Object.values(narrative.artifacts ?? {}).flatMap((a) => Object.keys(a.world.nodes)),
  ];
  // Count world nodes: worldDeltas + new entities' initial world nodes
  const totalNodeDeltas = scenes.reduce((sum, s) => {
    const worldDeltaNodes = s.worldDeltas.reduce((ns, km) => ns + (km.addedNodes?.length ?? 0), 0);
    const newEntityNodes = (s.newCharacters ?? []).reduce((ns, c) => ns + Object.keys(c.world?.nodes ?? {}).length, 0)
      + (s.newLocations ?? []).reduce((ns, l) => ns + Object.keys(l.world?.nodes ?? {}).length, 0)
      + (s.newArtifacts ?? []).reduce((ns, a) => ns + Object.keys(a.world?.nodes ?? {}).length, 0);
    return sum + worldDeltaNodes + newEntityNodes;
  }, 0);
  const kIds = nextIds('K', existingKIds, totalNodeDeltas);
  let kIdx = 0;
  // Remap worldDelta node IDs
  for (const scene of scenes) {
    for (const km of scene.worldDeltas) {
      for (const node of km.addedNodes ?? []) {
        node.id = kIds[kIdx++];
      }
    }
  }
  // Remap new entity world node IDs
  for (const scene of scenes) {
    for (const c of scene.newCharacters ?? []) {
      if (c.world?.nodes) {
        const remappedNodes: typeof c.world.nodes = {};
        for (const [, node] of Object.entries(c.world.nodes)) {
          const newId = kIds[kIdx++];
          remappedNodes[newId] = { ...node, id: newId };
        }
        c.world.nodes = remappedNodes;
      }
    }
    for (const l of scene.newLocations ?? []) {
      if (l.world?.nodes) {
        const remappedNodes: typeof l.world.nodes = {};
        for (const [, node] of Object.entries(l.world.nodes)) {
          const newId = kIds[kIdx++];
          remappedNodes[newId] = { ...node, id: newId };
        }
        l.world.nodes = remappedNodes;
      }
    }
    for (const a of scene.newArtifacts ?? []) {
      if (a.world?.nodes) {
        const remappedNodes: typeof a.world.nodes = {};
        for (const [, node] of Object.entries(a.world.nodes)) {
          const newId = kIds[kIdx++];
          remappedNodes[newId] = { ...node, id: newId };
        }
        a.world.nodes = remappedNodes;
      }
    }
  }

  // Thread log node IDs are now deterministic (`${threadId}:${sceneId}`)
  // derived by applyThreadDelta — no allocation needed. The reducer owns
  // log-node creation; sanitizer only validates the evidence payload.

  // Sanitize and re-ID system knowledge deltas. Concept-based resolution
  // collapses re-mentioned concepts (existing-graph or earlier-in-batch) to
  // their canonical id so that re-asserting "mana-binding" across scenes
  // does not repeatedly count as a new node and inflate System scores.
  const existingSysNodes = narrative.systemGraph?.nodes ?? {};
  // Cumulative node map: starts as the existing graph and grows with each
  // scene's genuinely-new nodes, so the next scene's resolve sees earlier
  // scenes' contributions as already-known.
  const cumulativeSysNodes: Record<string, SystemNode> = { ...existingSysNodes };
  const allocateFreshSysId = makeSystemIdAllocator(Object.keys(cumulativeSysNodes));
  // Cumulative id remap across all scenes — one entry per LLM-emitted placeholder id.
  const wkIdMap: Record<string, string> = {};
  const validSysIds = new Set<string>(Object.keys(cumulativeSysNodes));
  // Seed seen-edges from the narrative's existing graph so we don't re-add
  // edges that already exist upstream.
  const seenSysEdgeKeys = new Set<string>();
  for (const e of narrative.systemGraph?.edges ?? []) seenSysEdgeKeys.add(systemEdgeKey(e));

  for (const scene of scenes) {
    if (!scene.systemDeltas) {
      scene.systemDeltas = { addedNodes: [], addedEdges: [] };
    }
    scene.systemDeltas.addedNodes = scene.systemDeltas.addedNodes ?? [];
    scene.systemDeltas.addedEdges = scene.systemDeltas.addedEdges ?? [];
    // Resolve concepts: existing wins, then within-scene dupes collapse,
    // then genuinely new concepts get fresh SYS-XX ids.
    const resolved = resolveSystemConceptIds(
      scene.systemDeltas.addedNodes,
      cumulativeSysNodes,
      allocateFreshSysId,
    );
    Object.assign(wkIdMap, resolved.idMap);
    scene.systemDeltas.addedNodes = resolved.newNodes;
    for (const n of resolved.newNodes) {
      cumulativeSysNodes[n.id] = n;
      validSysIds.add(n.id);
    }
    // Remap edge references using the cumulative map (LLM GEN ids, prior-
    // scene real ids, and existing graph ids all pass through correctly).
    scene.systemDeltas.addedEdges = scene.systemDeltas.addedEdges.map((edge) => ({
      from: wkIdMap[edge.from] ?? edge.from,
      to: wkIdMap[edge.to] ?? edge.to,
      relation: edge.relation,
    }));
    // Centralised sanitization: self-loops, orphans, cross-scene dupes, bad fields
    sanitizeSystemDelta(scene.systemDeltas, validSysIds, seenSysEdgeKeys);
  }

  const newSceneIds = scenes.map((s) => s.id);
  const newDevelops = [...new Set(scenes.flatMap((s) => s.threadDeltas.map((tm) => tm.threadId)))];
  const newLocationIds = [...new Set(scenes.map((s) => s.locationId))];
  const newCharacterIds = [...new Set(scenes.flatMap((s) => s.participantIds))];

  const arc: Arc = existingArc
    ? {
        ...existingArc,
        sceneIds: [...existingArc.sceneIds, ...newSceneIds],
        develops: [...new Set([...existingArc.develops, ...newDevelops])],
        locationIds: [...new Set([...existingArc.locationIds, ...newLocationIds])],
        activeCharacterIds: [...new Set([...existingArc.activeCharacterIds, ...newCharacterIds])],
        worldState: worldState ?? existingArc.worldState,
      }
    : {
        id: arcId,
        name: arcName,
        sceneIds: newSceneIds,
        develops: newDevelops,
        locationIds: newLocationIds,
        activeCharacterIds: newCharacterIds,
        initialCharacterLocations: {},
        directionVector,
        worldState,
      };

  if (!existingArc && scenes.length > 0) {
    for (const cid of arc.activeCharacterIds) {
      const firstScene = scenes.find((s) => s.participantIds.includes(cid));
      if (firstScene) {
        arc.initialCharacterLocations[cid] = firstScene.locationId;
      }
    }
  }

  logInfo('Completed scene generation', {
    source: 'manual-generation',
    operation: 'generate-scenes-complete',
    details: {
      narrativeId: narrative.id,
      arcId,
      arcName,
      scenesGenerated: scenes.length,
      threadsAdvanced: newDevelops.length,
      locationsUsed: newLocationIds.length,
      charactersUsed: newCharacterIds.length,
    },
  });

  // ── Generate embeddings for scene summaries ──────────────────────────────
  const { generateEmbeddingsBatch, computeCentroid, resolveEmbedding } = await import('@/lib/embeddings');
  const { assetManager } = await import('@/lib/asset-manager');

  if (scenes.length > 0) {
    // Batch 1: Embed scene summaries
    const sceneSummaries = scenes.map(s => s.summary);
    const summaryEmbeddings = await generateEmbeddingsBatch(sceneSummaries, narrative.id);

    // Store embeddings in AssetManager and use references
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const embeddingId = await assetManager.storeEmbedding(summaryEmbeddings[i], 'text-embedding-3-small');
      scene.summaryEmbedding = embeddingId;

      // If scene has plan (in version array), compute plan centroid from beat centroids
      const latestPlan = scene.planVersions?.[scene.planVersions.length - 1]?.plan;
      if (latestPlan) {
        const resolvedCentroids = (await Promise.all(
          latestPlan.beats.map(b => resolveEmbedding(b.embeddingCentroid))
        )).filter((e): e is number[] => e !== null);
        if (resolvedCentroids.length > 0) {
          scene.planEmbeddingCentroid = await assetManager.storeEmbedding(computeCentroid(resolvedCentroids), 'text-embedding-3-small');
        }
      }
    }
  }

  return { scenes, arc };
}

/**
 * Phase 1 — fact extraction. Reads the scene's own structural data (summary,
 * deltas, new entities, events) and returns the minimum set of compulsory
 * propositions the scene must land. Scene-only context; no narrative history.
 */
async function extractCompulsoryPropositions(
  narrative: NarrativeState,
  scene: Scene,
  onReasoning: ((token: string) => void) | undefined,
  reasoningBudget: number | undefined,
): Promise<Proposition[]> {
  const systemPrompt = `You are a scene fact-extractor. Read the scene's structural data (summary, deltas, new entities, events) and return the COMPLETE set of compulsory propositions the scene must land.

A compulsory proposition is a fact the prose MUST establish for the scene to count as having happened. Not atmosphere. Not craft flourish. The discrete, checkable claims a reader must come away believing.

THOROUGHNESS — every structural element in the scene data maps to at least one proposition. Walk through the data and confirm you've covered:
  - summary → any commitments the summary makes that aren't yet captured by deltas below
  - each threadDelta → one proposition for the narrative fact that moved the thread (use the thread's description and addedNodes as anchors)
  - each worldDelta → one proposition per addedNode, framed in present-tense state ("X now Y")
  - systemDelta addedNodes → the world rule/principle surfaced
  - relationshipDeltas → the concrete shift ("A now distrusts B")
  - ownershipDeltas → the transfer fact
  - tieDeltas → the tie established or severed
  - artifactUsages → what the artifact did
  - characterMovements → the arrival/departure fact
  - events → any fact the event tag implies that isn't already captured
  - new-characters / new-locations / new-artifacts / new-threads → that this entity now exists, plus one proposition per meaningful world-node they carry in
Completeness matters more than minimalism. A missed delta becomes a continuity hole in later scenes.

DO NOT deduplicate across delta types — each delta is its own commitment even if the surface wording overlaps.
DO NOT include sensory texture, weather, or obvious background.
DO NOT impose an ordering — emit propositions grouped by source for clarity; reordering for prose effect is the planner's job.

Return ONLY JSON: { "propositions": [{"content": "...", "type": "..."}, ...] }
Type is a free label (event, state, rule, relation, secret, goal, transfer, tie, movement, emergence…). Each proposition should be a single complete sentence stating one fact.`;

  const userPrompt = `${sceneContext(narrative, scene)}\n\nExtract every compulsory proposition from the scene above. Walk through every block of the XML; no structural element goes uncovered.`;

  const raw = onReasoning
    ? await callGenerateStream(userPrompt, systemPrompt, () => {}, MAX_TOKENS_SMALL, 'generateScenePlan.extractPropositions', GENERATE_MODEL, reasoningBudget, onReasoning)
    : await callGenerate(userPrompt, systemPrompt, MAX_TOKENS_SMALL, 'generateScenePlan.extractPropositions', GENERATE_MODEL, reasoningBudget);

  const parsed = parseJson(raw, 'generateScenePlan.extractPropositions') as { propositions?: unknown[] };
  return parsePropositions(Array.isArray(parsed.propositions) ? parsed.propositions : []);
}

/**
 * Phase 2 — plan construction. Enrich and order the compulsory propositions
 * into a beat plan using the full narrative context. Emits varied mechanisms
 * so the scene breathes — follows a Markov-sampled beat sequence when the
 * narrative has one, otherwise composes freely.
 */
async function constructBeatPlan(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  compulsoryPropositions: Proposition[],
  guidance: string | undefined,
  onReasoning: ((token: string) => void) | undefined,
  reasoningBudget: number | undefined,
): Promise<BeatPlan> {
  const sceneIdx = resolvedKeys.indexOf(scene.id);
  const contextIndex = sceneIdx >= 0 ? sceneIdx : resolvedKeys.length - 1;
  const storySettings: StorySettings = { ...DEFAULT_STORY_SETTINGS, ...narrative.storySettings };

  // Previous scene continuity — final few beats + ending beat type
  const prevSceneKey = sceneIdx > 0 ? resolvedKeys[sceneIdx - 1] : null;
  const prevScene = prevSceneKey ? narrative.scenes[prevSceneKey] : null;
  const prevPlan = prevScene?.planVersions?.[prevScene.planVersions.length - 1]?.plan;
  const adjacentBlock = prevPlan
    ? `PREVIOUS SCENE ends with: ${prevPlan.beats.slice(-3).map((b) => `[${b.fn}:${b.mechanism}] ${b.what}`).join(', ')}`
    : '';

  // FIXED BEAT SLOTS — the sampler deterministically assigns the (fn, mechanism)
  // pair for every beat in the plan. The LLM only fills `what` and
  // `propositions` per slot; it does NOT pick fn or mechanism. This is how the
  // story's voice (the mechanism mix) becomes enforceable rather than
  // aspirational — the sampler owns rhythm, the LLM owns content. The fallback
  // path (`useBeatChain=false`) returns no slots and keeps the LLM free.
  //
  // We over-sample a generous number of slots so the LLM has room to pack as
  // many propositions as needed. Slots beyond what the LLM uses are silently
  // dropped; if the LLM needs more than we sampled, we'll extend server-side
  // during post-generation normalization.
  const sampledSlots = (() => {
    if (storySettings.useBeatChain === false) return null;
    const sampler = resolveSampler(narrative);
    if (!sampler) return null;
    const propCount = compulsoryPropositions.length;
    const suggested = Math.max(6, Math.min(Math.ceil(propCount * 1.5), 18));
    return sampleBeatSequence(sampler, suggested, prevPlan?.beats?.at(-1)?.fn);
  })();

  const beatSlotsBlock = (() => {
    if (!sampledSlots || sampledSlots.length === 0) return '';
    const lines = sampledSlots.map((b, i) => `  Slot ${i + 1}: ${b.fn}:${b.mechanism}`);
    return `\nFIXED BEAT SLOTS — the sampler has pre-assigned each beat's \`fn\` and \`mechanism\`. These are the story's voice and are NOT negotiable:\n${lines.join('\n')}\n\nYour job per beat is to fill in \`what\` and \`propositions\` only. DO NOT change \`fn\` or \`mechanism\` — copy them verbatim from the slot into each beat's output. Use slots in order (slot 1 = beat 1, slot 2 = beat 2, ...). If your content fits in fewer beats than slots provided, stop early; trailing slots are discarded. If a mechanism seems to clash with the scene (e.g. \`dialogue\` in a solitary POV), render it creatively within that mechanism (interior monologue spoken aloud, muttered side-remark, conversation with an absent party) rather than substituting — the mix is the voice, and every substitution drifts the voice. Structural exceptions are a last resort, not a default.\n`;
  })();

  const compulsoryBlock = compulsoryPropositions.length > 0
    ? `\nCOMPULSORY PROPOSITIONS — the prose MUST transmit every one of these facts. They are what the scene commits to.

The list below is in EXTRACTION ORDER (grouped by structural source). Extraction order is NOT delivery order. Your job:

  1. COVERAGE — every proposition lands in some beat. None dropped.
  2. REORDER — sequence them for maximum narrative effect. Late reveals, early hooks, payoff after setup, interleaved lines of action. The order on the page is a craft decision; the extraction order is just a checklist.
  3. GLUE — where the narrative context shows a gap (a relationship the reader hasn't seen recently, a rule about to be invoked, a memory that frames a moment), add a small number of glue propositions from the narrative context to bridge. Glue enriches; it does not replace.
  4. GROUP — multiple propositions can share a beat when they deliver together (a single dialogue exchange can carry three thread moves). Don't force 1:1.

DELIVERY — prose style follows the PROSE PROFILE above, not a rigid order. The profile decides whether propositions are demonstrated, stated, or imaged; the plan just says WHERE in the scene each lands and WHICH mechanism carries it.

Compulsory propositions (extraction order, group by blank line for readability):

${compulsoryPropositions
      .map((p, i) => `${i + 1}. ${p.content}${p.type ? ` [${p.type}]` : ''}`)
      .join('\n')}\n`
    : '';

  const profileBlock = `\n${buildProseProfile(resolveProfile(narrative))}${beatSlotsBlock}\n`;
  const systemPrompt = buildScenePlanSystemPrompt()
    + (() => {
      const parts = [narrative.storySettings?.planGuidance?.trim(), guidance?.trim()].filter(Boolean);
      return parts.length > 0 ? `\n\nPLAN GUIDANCE:\n${parts.join('\n')}` : '';
    })();

  const prompt = `${profileBlock}NARRATIVE CONTEXT:\n${narrativeContext(narrative, resolvedKeys, contextIndex)}
${buildThreadHealthPrompt(narrative, resolvedKeys, contextIndex) ? `\n${buildThreadHealthPrompt(narrative, resolvedKeys, contextIndex)}\n` : ''}${buildCompletedBeatsPrompt(narrative, resolvedKeys, contextIndex) ? `\n${buildCompletedBeatsPrompt(narrative, resolvedKeys, contextIndex)}\n` : ''}${adjacentBlock ? `${adjacentBlock}\n\n` : ''}
SCENE:
${sceneContext(narrative, scene)}
${compulsoryBlock}
Generate a beat plan that GLUES the compulsory propositions into the narrative flow: reordered for effect, enriched with bridge propositions drawn from the narrative context where continuity calls for them, grouped into beats, and paced with varied mechanisms. Coverage is non-negotiable; the ORDERING and GROUPING are your craft decisions. Prose delivery will follow the prose profile — your job is the skeleton, not the voice.

OPENING SHAPE — check the <time-gap> on the scene. Good storytelling weaves the passage of time into narrative texture so the reader always feels it without ever reading it as a timestamp. The gap size shifts how visible the weaving is, not whether it happens. MINOR gaps (concurrent, hours, same-day, multi-day): texture only — light, mood, weather, wear, what's changed. NEVER a "X days later" beat. NOTABLE gaps (multi-week): weave a clearer signal — a season turning, a project moved on, a wound healing. Still texture, not statement. MAJOR gaps (multi-month): weight it with a re-anchor beat (status update, changed season, plan bearing fruit); naming the elapsed time directly is permitted when it carries force. GENERATIONAL gaps (year+): must be acknowledged with weight — a montage beat, an aged-up reveal, an environmental change. Underplaying a generational jump reads as continuity error.`;

  const raw = onReasoning
    ? await callGenerateStream(prompt, systemPrompt, () => {}, MAX_TOKENS_SMALL, 'generateScenePlan', GENERATE_MODEL, reasoningBudget, onReasoning)
    : await callGenerate(prompt, systemPrompt, MAX_TOKENS_SMALL, 'generateScenePlan', GENERATE_MODEL, reasoningBudget);

  const parsed = parseJson(raw, 'generateScenePlan') as { beats?: unknown[] };
  const rawBeats = parsed.beats ?? [];

  // If deterministic slots are active, the sampler OWNS fn + mechanism. Extend
  // the sample if the LLM returned more beats than we pre-sampled so every
  // emitted beat still has a sampler-assigned slot. The LLM is only allowed to
  // author `what` + `propositions`; anything it wrote for `fn` / `mechanism`
  // is discarded in favour of the slot. This is the enforcement step that
  // makes the story's voice (mechanism distribution) actually deterministic.
  let slots = sampledSlots;
  if (slots && rawBeats.length > slots.length) {
    const sampler = resolveSampler(narrative);
    const extra = sampleBeatSequence(
      sampler,
      rawBeats.length - slots.length,
      slots[slots.length - 1]?.fn ?? prevPlan?.beats?.at(-1)?.fn,
    );
    slots = [...slots, ...extra];
  }

  const beats = rawBeats.map((b: unknown, i: number) => {
    const beat = b as Record<string, unknown>;
    const rawProps = Array.isArray(beat.propositions) ? beat.propositions : [];
    const slot = slots?.[i];
    const fn = slot
      ? slot.fn
      : ((BEAT_FN_LIST as readonly string[]).includes(String(beat.fn)) ? beat.fn : 'advance') as BeatPlan['beats'][0]['fn'];
    const mechanism = slot
      ? slot.mechanism
      : ((BEAT_MECHANISM_LIST as readonly string[]).includes(String(beat.mechanism)) ? beat.mechanism : 'action') as BeatPlan['beats'][0]['mechanism'];
    return {
      fn: fn as BeatPlan['beats'][0]['fn'],
      mechanism: mechanism as BeatPlan['beats'][0]['mechanism'],
      what: String(beat.what ?? ''),
      propositions: parsePropositions(rawProps),
      embeddingCentroid: undefined as string | undefined,
    };
  });
  return { beats };
}

export async function generateScenePlan(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  onReasoning?: (token: string) => void,
  onMeta?: (meta: { compulsoryCount: number }) => void,
  /** Per-scene direction that supplements storySettings.planGuidance */
  guidance?: string,
  /** Skip embedding generation — used by plan candidates where only the winner gets embedded */
  skipEmbeddings?: boolean,
): Promise<BeatPlan> {
  logInfo('Starting beat plan generation', {
    source: 'plan-generation',
    operation: 'generate-plan',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      sceneSummary: scene.summary.substring(0, 60),
      hasGuidance: !!guidance,
    },
  });

  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;

  // ── Phase 1 — extract compulsory propositions from scene structure ──
  const compulsoryPropositions = await extractCompulsoryPropositions(narrative, scene, onReasoning, reasoningBudget);
  onMeta?.({ compulsoryCount: compulsoryPropositions.length });
  logInfo('Compulsory propositions extracted', {
    source: 'plan-generation',
    operation: 'extract-propositions',
    details: { sceneId: scene.id, count: compulsoryPropositions.length },
  });

  // ── Phase 2 — enrich and order into a full beat plan ────────────────
  const result = await constructBeatPlan(
    narrative, scene, resolvedKeys, compulsoryPropositions, guidance, onReasoning, reasoningBudget,
  );

  // ── Generate embeddings for all propositions (skipped for candidates) ────
  if (skipEmbeddings) return result;

  const { embedPropositions, computeCentroid, resolveEmbedding } = await import('@/lib/embeddings');
  const { assetManager } = await import('@/lib/asset-manager');

  // Collect all propositions from beats
  const allPropositions: Array<{ content: string; type?: string }> = [];
  result.beats.forEach(beat => {
    allPropositions.push(...beat.propositions);
  });

  // Embed all propositions in batch
  if (allPropositions.length > 0) {
    const embeddedProps = await embedPropositions(allPropositions, narrative.id);

    // Map embeddings back to plan
    let embeddedIndex = 0;
    for (const beat of result.beats) {
      for (let i = 0; i < beat.propositions.length; i++) {
        beat.propositions[i] = embeddedProps[embeddedIndex++];
      }

      // Compute beat centroid from proposition embeddings and store as asset
      const beatEmbeddings = (await Promise.all(
        beat.propositions.map(p => resolveEmbedding(p.embedding))
      )).filter((e): e is number[] => e !== null);
      if (beatEmbeddings.length > 0) {
        const centroid = computeCentroid(beatEmbeddings);
        beat.embeddingCentroid = await assetManager.storeEmbedding(centroid, 'text-embedding-3-small');
      }
    }
  }

  logInfo('Completed beat plan generation', {
    source: 'plan-generation',
    operation: 'generate-plan-complete',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      beatsGenerated: result.beats.length,
      totalPropositions: result.beats.reduce((sum, b) => sum + b.propositions.length, 0),
    },
  });

  return result;
}

/**
 * Edit an existing beat plan to address specific issues from plan evaluation.
 * Unlike generateScenePlan, this receives the current plan + issues and returns
 * a surgically modified plan — only the beats with problems are changed.
 *
 * Lightweight: no full narrative context, no logic context — focused on fixing specific issues.
 */
export async function editScenePlan(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  issues: string[],
  /** Resolved plan for versioned scenes (required - pass from resolvePlanForBranch) */
  currentPlan?: BeatPlan,
): Promise<BeatPlan> {
  const plan = currentPlan;
  if (!plan) throw new Error('Scene has no plan to edit - pass resolved plan from resolvePlanForBranch');

  logInfo('Starting scene plan edit', {
    source: 'plan-generation',
    operation: 'edit-plan',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      issuesCount: issues.length,
      currentBeats: plan.beats.length,
    },
  });

  const sceneIdx = resolvedKeys.indexOf(scene.id);
  const contextIndex = sceneIdx >= 0 ? sceneIdx : resolvedKeys.length - 1;
  const fullContext = narrativeContext(narrative, resolvedKeys, contextIndex);

  const currentPlanJson = JSON.stringify({
    beats: plan.beats.map((b, i) => ({ idx: i + 1, fn: b.fn, mechanism: b.mechanism, what: b.what, propositions: b.propositions })),
  }, null, 2);

  const issueBlock = issues.map((iss, i) => `${i + 1}. ${iss}`).join('\n');

  const sceneDesc = `Scene: ${scene.summary}`;

  const prompt = `NARRATIVE CONTEXT:\n${fullContext}

SCENE AT BRANCH HEAD:
${sceneDesc}

CURRENT BEAT PLAN:
${currentPlanJson}

ISSUES TO FIX:
${issueBlock}

Edit the beat plan to address every issue above. You may:
- Modify a beat's fn, mechanism, what, or propositions
- Add new beats (to fill gaps or add missing setups)
- Remove beats (if redundant or contradictory)
- Reorder beats (if sequencing is wrong)

CRITICAL: The 'what' field must be a STRUCTURAL SUMMARY of what happens, NOT pre-written prose.
- DO: "Guard confronts him about the forged papers" — structural event
- DON'T: "He muttered, 'The academy won't hold me long'" — pre-written prose with quotes
- DO: "Mist covers the village" — simple fact
- DON'T: "Mist clung, blurring the distinction..." — literary prose
Strip adjectives, adverbs, literary embellishments. State the event, not its texture.

Keep beats that have NO issues exactly as they are — do not rewrite beats that are working.
Return the COMPLETE plan (all beats, not just changed ones) as JSON:
{
  "beats": [
    { "fn": "${BEAT_FN_LIST.join('|')}", "mechanism": "${BEAT_MECHANISM_LIST.join('|')}", "what": "...", "propositions": [{"content": "..."}] }
  ],
  "propositions": [{"content": "..."}]
}`;

  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;
  const raw = await callGenerate(prompt, SYSTEM_PROMPT, MAX_TOKENS_SMALL, 'editScenePlan', GENERATE_MODEL, reasoningBudget);

  const parsed = parseJson(raw, 'editScenePlan') as { beats?: unknown[]; propositions?: unknown[] };
  const beats = (parsed.beats ?? []).map((b: unknown) => {
    const beat = b as Record<string, unknown>;
    const rawProps = Array.isArray(beat.propositions) ? beat.propositions : [];
    return {
      fn: ((BEAT_FN_LIST as readonly string[]).includes(String(beat.fn)) ? beat.fn : 'advance') as BeatPlan['beats'][0]['fn'],
      mechanism: ((BEAT_MECHANISM_LIST as readonly string[]).includes(String(beat.mechanism)) ? beat.mechanism : 'action') as BeatPlan['beats'][0]['mechanism'],
      what: String(beat.what ?? ''),
      propositions: parsePropositions(rawProps),
    };
  });

  logInfo('Completed scene plan edit', {
    source: 'plan-generation',
    operation: 'edit-plan-complete',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      beatsReturned: beats.length,
    },
  });

  return { beats };
}

/**
 * Reverse-engineer a beat plan from existing prose.
 * Used for analysis — extracts structural beats with propositions.
 * Focused on exhaustive proposition extraction; paragraph mapping is done separately.
 *
 * Returns the plan with beats and propositions.
 */
/**
 * Split prose into evenly-sized chunks by sentence/paragraph boundaries.
 * Ensures consistent granularity for beat extraction.
 */
/**
 * Split prose into ~100-word chunks on sentence boundaries.
 * Chunks are allowed to exceed 100 words to avoid breaking mid-sentence.
 */
export function splitIntoWordChunks(prose: string, targetWords: number = WORDS_PER_BEAT): string[] {
  const sentences = splitIntoSentences(prose).filter(s => s.trim());
  if (sentences.length === 0) return [prose];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    current.push(sentence);
    currentWords += sentenceWords;

    // Break after reaching target — allows the sentence that crosses the boundary to finish
    if (currentWords >= targetWords) {
      chunks.push(current.join(' ').trim());
      current = [];
      currentWords = 0;
    }
  }

  // Flush remaining sentences
  if (current.length > 0) {
    const remainder = current.join(' ').trim();
    // If remainder is very short, merge into the last chunk
    if (chunks.length > 0 && currentWords < targetWords * 0.3) {
      chunks[chunks.length - 1] += ' ' + remainder;
    } else {
      chunks.push(remainder);
    }
  }

  return chunks.length > 0 ? chunks : [prose];
}

export async function reverseEngineerScenePlan(
  prose: string,
  summary: string,
  onToken?: (token: string, accumulated: string) => void,
): Promise<{ plan: BeatPlan; beatProseMap: BeatProseMap | null }> {
  // Wrap with retry logic and validation
  return retryWithValidation(
    async () => {
      const result = await reverseEngineerScenePlanOnce(prose, summary, onToken);

      // Validate beat plan structure
      const planValidation = validateBeatPlan({ beats: result.plan.beats });
      if (!planValidation.valid) {
        throw new Error(`Beat plan validation failed:\n${planValidation.errors.join('\n')}`);
      }

      // Validate prose map — required for side-by-side view
      if (result.beatProseMap) {
        const mapValidation = validateBeatProseMap(result.beatProseMap, result.plan, prose);
        if (!mapValidation.valid) {
          throw new Error(`Beat prose map validation failed:\n${mapValidation.errors.join('\n')}`);
        }
      } else {
        throw new Error('No beat prose map generated - side-by-side view requires valid mapping');
      }

      return result;
    },
    () => ({ valid: true, errors: [] }), // Validation already done inside
    'reverseEngineerScenePlan',
    3,
    'analysis' // source context for logging
  );
}

/**
 * Single attempt at extracting a beat plan from prose (internal, for retry logic)
 */
async function reverseEngineerScenePlanOnce(
  prose: string,
  summary: string,
  onToken?: (token: string, accumulated: string) => void,
): Promise<{ plan: BeatPlan; beatProseMap: BeatProseMap | null }> {
  // Strip decorative content before splitting
  const cleanedProse = prose
    .split(/\n\s*\n/)
    .filter((p: string) => p.replace(/[\s*·•–—\-=_#~.]/g, '').trim().length > 0)
    .join('\n\n');

  // Deterministic ~100-word chunks — one chunk = one beat
  const chunks = splitIntoWordChunks(cleanedProse);
  const chunksJson = JSON.stringify(chunks.map((c: string, i: number) => ({ index: i, text: c })));

  const systemPrompt = buildBeatAnalystSystemPrompt(chunks.length);

  const prompt = `SCENE SUMMARY: ${summary}

CHUNKS (${chunks.length} items, ~100 words each — annotate each one):
${chunksJson}

TASK:
Annotate each chunk with its beat function, mechanism, and propositions. One beat per chunk, in order.

Extract propositions according to density guidelines — light fiction gets 1-2 props/beat, technical prose gets exhaustive extraction.

CONSTRAINTS:
- Return exactly ${chunks.length} beats — one per chunk.
- Use ONLY these 10 beat functions: breathe, inform, advance, bond, turn, reveal, shift, expand, foreshadow, resolve`;

  let accumulated = '';
  const raw = onToken
    ? await callGenerateStream(prompt, systemPrompt, (token) => { accumulated += token; onToken(token, accumulated); }, MAX_TOKENS_SMALL, 'reverseEngineerScenePlan', GENERATE_MODEL, undefined, undefined, ANALYSIS_TEMPERATURE)
    : await callGenerate(prompt, systemPrompt, MAX_TOKENS_SMALL, 'reverseEngineerScenePlan', GENERATE_MODEL, undefined, true, ANALYSIS_TEMPERATURE);

  type BeatData = { fn: string; mechanism: string; what: string; propositions: unknown[] };
  const parsed = parseJson(raw, 'reverseEngineerScenePlan') as { beats?: unknown[] };

  const beats: Beat[] = (parsed.beats ?? []).map((b: unknown) => {
    const beatData = b as BeatData;
    const rawProps = Array.isArray(beatData.propositions) ? beatData.propositions : [];
    return {
      fn: ((BEAT_FN_LIST as readonly string[]).includes(String(beatData.fn)) ? beatData.fn : 'advance') as Beat['fn'],
      mechanism: ((BEAT_MECHANISM_LIST as readonly string[]).includes(String(beatData.mechanism)) ? beatData.mechanism : 'action') as Beat['mechanism'],
      what: String(beatData.what ?? ''),
      propositions: parsePropositions(rawProps),
    };
  });

  // LLM must return exactly one beat per chunk — mismatch is a retry-worthy failure
  if (beats.length !== chunks.length) {
    throw new Error(`Beat count mismatch: got ${beats.length} beats for ${chunks.length} chunks`);
  }

  const plan: BeatPlan = { beats };

  // Prose map is deterministic — chunk i = beat i
  const beatProseMap: BeatProseMap = {
    chunks: chunks.map((prose, i) => ({ beatIndex: i, prose })),
    createdAt: Date.now(),
  };

  return { plan, beatProseMap };
}

/**
 * Build BeatProseMap from chunk counts. Deterministic — no gaps or overlaps possible.
 * The only validation: counts must sum to total paragraphs and each count must be >= 1.
 */
export function buildBeatProseMapFromCounts(
  paragraphs: string[],
  beats: Beat[],
  chunkCounts: number[],
  startIndices?: (number | undefined)[],
): BeatProseMap | null {
  if (paragraphs.length === 0 || beats.length === 0 || chunkCounts.length !== beats.length) return null;

  // Fix simple off-by-one/two errors by adjusting the last beat; anything else regenerates
  const total = chunkCounts.reduce((a, b) => a + b, 0);
  if (total !== paragraphs.length) {
    const diff = paragraphs.length - total;
    const lastIdx = chunkCounts.length - 1;
    if (Math.abs(diff) <= 2 && chunkCounts[lastIdx] + diff >= 1) {
      chunkCounts[lastIdx] += diff;
    } else {
      logWarning('Beat chunk counts do not sum to paragraph count',
        `Sum ${total} ≠ ${paragraphs.length} paragraphs`,
        { source: 'analysis', operation: 'beat-prose-mapping', details: { total, expected: paragraphs.length, counts: chunkCounts.join(',') } }
      );
      return null;
    }
  }

  const chunks: BeatProse[] = [];
  let cursor = 0;

  for (let i = 0; i < chunkCounts.length; i++) {
    const count = chunkCounts[i];
    if (count < 1) {
      logWarning('Beat has zero or negative chunk count',
        `Beat ${i} has chunks=${count}`,
        { source: 'analysis', operation: 'beat-prose-mapping', details: { beatIndex: i, count } }
      );
      return null;
    }

    // startIndex is the source of truth — must match computed cursor exactly
    const expectedStart = startIndices?.[i];
    if (typeof expectedStart === 'number' && expectedStart !== cursor) {
      logWarning('Beat startIndex does not match expected position',
        `Beat ${i}: startIndex=${expectedStart} but expected ${cursor}`,
        { source: 'analysis', operation: 'beat-prose-mapping', details: { beatIndex: i, startIndex: expectedStart, cursor, count } }
      );
      return null;
    }

    const prose = paragraphs.slice(cursor, cursor + count).join('\n\n').trim();
    if (!prose) {
      logWarning('Beat prose is empty', `Beat ${i} spans paragraphs ${cursor}–${cursor + count - 1} but produced empty text`,
        { source: 'analysis', operation: 'beat-prose-mapping', details: { beatIndex: i, cursor, count } }
      );
      return null;
    }

    chunks.push({ beatIndex: i, prose });
    cursor += count;
  }

  return { chunks, createdAt: Date.now() };
}

/**
 * Rewrite a scene plan guided by user-provided analysis/critique.
 * Preserves the plan structure but revises content based on the feedback.
 *
 * Lightweight: no full narrative context, no logic context — focused on feedback.
 */
export async function rewriteScenePlan(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  currentPlan: BeatPlan,
  analysis: string,
  onReasoning?: (token: string) => void,
): Promise<BeatPlan> {
  logInfo('Starting scene plan rewrite', {
    source: 'plan-generation',
    operation: 'rewrite-plan',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      currentBeats: currentPlan.beats.length,
      analysisLength: analysis.length,
    },
  });

  const sceneIdx = resolvedKeys.indexOf(scene.id);
  const contextIndex = sceneIdx >= 0 ? sceneIdx : resolvedKeys.length - 1;
  const fullContext = narrativeContext(narrative, resolvedKeys, contextIndex);

  const currentPlanText = currentPlan.beats.map((b, i) =>
    `${i + 1}. [${b.fn}:${b.mechanism}] ${b.what}\n   Propositions: ${b.propositions.map(p => `"${p.content}"`).join('; ')}`
  ).join('\n');


  const systemPrompt = buildScenePlanEditSystemPrompt(narrative.title);

  const sceneDesc = `Scene at branch head: ${scene.summary}`;

  const prompt = `NARRATIVE CONTEXT:\n${fullContext}

SCENE AT BRANCH HEAD:
${sceneDesc}

CURRENT PLAN:
${currentPlanText}

TARGETED FEEDBACK:
${analysis}

Make TARGETED REVISIONS based on the feedback above. This is a surgical edit, not a regeneration.

CRITICAL — PRESERVE STRUCTURE:
1. Return ALL ${currentPlan.beats.length} beats — do not add or remove unless feedback explicitly requests it
2. For beats NOT mentioned in feedback: copy them EXACTLY (same fn, mechanism, what, propositions)
3. For beats mentioned in feedback: apply the specific changes requested
4. Maintain the scene's narrative arc and flow

WHEN MODIFYING A BEAT:
- The 'what' field must be a STRUCTURAL SUMMARY, not prose (no quotes, no literary language)
- Update propositions to match the new content (2-4 per beat, with types: state, event, rule, discovery, etc.)
- Keep fn and mechanism unless the feedback specifically asks for a change

Scene-level "propositions" should capture the overall takeaways from the scene.`;

  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;
  const raw = onReasoning
    ? await callGenerateStream(prompt, systemPrompt, () => {}, MAX_TOKENS_SMALL, 'rewriteScenePlan', GENERATE_MODEL, reasoningBudget, onReasoning)
    : await callGenerate(prompt, systemPrompt, MAX_TOKENS_SMALL, 'rewriteScenePlan', GENERATE_MODEL, reasoningBudget);
  const parsed = parseJson(raw, 'rewriteScenePlan') as { beats?: unknown[]; propositions?: unknown[] };

  const beats = (parsed.beats ?? []).map((b: unknown) => {
    const beat = b as Record<string, unknown>;
    const rawProps = Array.isArray(beat.propositions) ? beat.propositions : [];
    return {
      fn: ((BEAT_FN_LIST as readonly string[]).includes(String(beat.fn)) ? beat.fn : 'advance') as BeatPlan['beats'][0]['fn'],
      mechanism: ((BEAT_MECHANISM_LIST as readonly string[]).includes(String(beat.mechanism)) ? beat.mechanism : 'action') as BeatPlan['beats'][0]['mechanism'],
      what: String(beat.what ?? ''),
      propositions: parsePropositions(rawProps),
    };
  });

  logInfo('Completed scene plan rewrite', {
    source: 'plan-generation',
    operation: 'rewrite-plan-complete',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      beatsReturned: beats.length > 0 ? beats.length : currentPlan.beats.length,
      usedFallback: beats.length === 0,
    },
  });

  return {
    beats: beats.length > 0 ? beats : currentPlan.beats,
  };
}

/**
 * Parse beat-aligned prose from LLM output with [BEAT_END:N] markers.
 * Returns clean prose + beatProseMap (prose strings) if markers are valid, otherwise prose only.
 *
 * @returns { prose, beatProseMap?, markersFailed } - markersFailed indicates if beat markers were missing/invalid
 */
function parseBeatProseMap(
  rawProse: string,
  beatCount: number,
): { prose: string; beatProseMap?: BeatProseMap; markersFailed?: boolean } {
  // If no markers, return prose as-is with failure flag
  if (!rawProse.includes('[BEAT_END:')) {
    logWarning('Beat markers not found in generated prose', 'LLM did not include BEAT_END markers', {
      source: 'prose-generation',
      operation: 'parse-beat-markers'
    });
    return { prose: rawProse, markersFailed: true };
  }

  // First pass: extract raw prose text per beat
  const beatTexts: { beatIndex: number; text: string }[] = [];
  const lines = rawProse.split('\n');
  let currentBeatIndex = 0;
  let currentProse: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*\[BEAT_END:(\d+)\]\s*$/);
    if (match) {
      const beatIndex = parseInt(match[1], 10);
      if (!isNaN(beatIndex) && beatIndex === currentBeatIndex) {
        const proseText = currentProse.join('\n').trim();
        // Always add beat, even if empty (to maintain beat count)
        beatTexts.push({ beatIndex, text: proseText });
        currentProse = [];
        currentBeatIndex++;
      } else {
        logWarning('Beat markers out of order', `Expected beat ${currentBeatIndex}, got ${beatIndex}`, {
          source: 'prose-generation',
          operation: 'parse-beat-markers',
          details: { expected: currentBeatIndex, got: beatIndex }
        });
        return { prose: rawProse.replace(/\[BEAT_END:\d+\]\n?/g, '').trim(), markersFailed: true };
      }
    } else {
      currentProse.push(line);
    }
  }

  // Handle final beat: only add if there's prose after the last marker OR we're missing beats
  const finalProse = currentProse.join('\n').trim();
  const needsFinalBeat = finalProse.length > 0 || currentBeatIndex < beatCount;

  if (needsFinalBeat) {
    beatTexts.push({ beatIndex: currentBeatIndex, text: finalProse });
  }

  // Reconstruct clean prose (no markers)
  const prose = beatTexts.map((b) => b.text).join('\n\n');

  // Validate we got expected number of beats with sequential indices
  if (beatTexts.length !== beatCount || !beatTexts.every((b, i) => b.beatIndex === i)) {
    logWarning('Beat count mismatch in generated prose', `Expected ${beatCount} beats, got ${beatTexts.length}`, {
      source: 'prose-generation',
      operation: 'parse-beat-markers',
      details: {
        expected: beatCount,
        actual: beatTexts.length,
        finalProseLength: finalProse.length,
        lastBeatIndex: currentBeatIndex - 1,
      }
    });
    return { prose: rawProse.replace(/\[BEAT_END:\d+\]\n?/g, '').trim(), markersFailed: true };
  }

  // Success: create beat-to-prose mapping with prose strings
  const chunks: BeatProse[] = beatTexts.map((bt) => ({
    beatIndex: bt.beatIndex,
    prose: bt.text,
  }));

  logInfo(`Successfully parsed ${chunks.length} beat chunks from prose`, {
    source: 'prose-generation',
    operation: 'parse-beat-markers',
    details: { beatCount: chunks.length }
  });

  return {
    prose,
    beatProseMap: {
      chunks,
      createdAt: Date.now(),
    },
    markersFailed: false,
  };
}

export async function generateSceneProse(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  onToken?: (token: string) => void,
  /** Per-scene prose direction appended to the system prompt */
  guidance?: string,
  /** Resolved plan to use (overrides scene.plan for versioned scenes) */
  plan?: BeatPlan,
): Promise<{ prose: string; beatProseMap?: BeatProseMap; proseEmbedding?: number[] }> {
  // Use provided plan (required for prose generation)
  const activePlan = plan ?? scene.planVersions?.[scene.planVersions.length - 1]?.plan;

  logInfo('Starting prose generation', {
    source: 'prose-generation',
    operation: 'generate-prose',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      sceneSummary: scene.summary.substring(0, 60),
      hasPlan: !!activePlan,
      hasGuidance: !!guidance,
    },
  });

  const sceneIdx = resolvedKeys.indexOf(scene.id);
  const contextIndex = sceneIdx >= 0 ? sceneIdx : resolvedKeys.length - 1;

  // Previous scene prose ending for transition continuity
  const prevSceneKey = sceneIdx > 0 ? resolvedKeys[sceneIdx - 1] : null;
  const prevScene = prevSceneKey ? narrative.scenes[prevSceneKey] : null;
  const prevProse = prevScene?.proseVersions?.[prevScene.proseVersions.length - 1]?.prose;
  const prevProseEnding = prevProse
    ? prevProse.split('\n').filter((l) => l.trim()).slice(-3).join('\n')
    : '';

  // Use resolveProfile to respect beatProfilePreset selection (same as generateScenePlan)
  const proseProfile = resolveProfile(narrative);

  // Build prose profile block
  const profileSection = proseProfile
    ? `\n\n${buildProseProfile(proseProfile)}`
    : '';

  const hasVoiceOverride = !!narrative.storySettings?.proseVoice?.trim();
  const proseFormat = narrative.storySettings?.proseFormat ?? 'prose';
  const formatInstructions = FORMAT_INSTRUCTIONS[proseFormat];

  // System prompt is minimal — style constraints moved to user prompt for stronger compliance
  const systemPrompt = buildSceneProseSystemPrompt({
    formatInstructions,
    narrativeTitle: narrative.title,
    worldSummary: narrative.worldSummary,
    proseVoiceOverride: hasVoiceOverride ? narrative.storySettings!.proseVoice! : undefined,
    direction: guidance,
  });

  const sceneBlock = sceneContext(narrative, scene, resolvedKeys, contextIndex);

  // Scene plan — when available, this is the primary creative direction
  const planBlock = activePlan
    ? `\nBEAT PLAN (follow this beat sequence — each beat maps to a passage of prose):
${activePlan.beats.map((b, i) =>
  `  ${i + 1}. [${b.fn}:${b.mechanism}] ${b.what}
     Propositions: ${b.propositions.map(p => `"${p.content}"`).join('; ')}`
).join('\n')}

PROPOSITIONS ARE STORY WORLD FACTS TO TRANSMIT — atomic claims the reader must come to believe are true. Your job is to transmit these beliefs through prose craft. NEVER copy propositions verbatim. NEVER state them as flat declarations. Transmit them through demonstration, implication, sensory detail, action, and atmosphere.

HOW TO TRANSMIT PROPOSITIONS:
Given proposition: "Mist covers the village at dawn"
  • Direct sensory: "He couldn't see past ten paces. Dampness clung to his skin."
  • Through action: "Houses materialized from whiteness as he walked."
  • Environmental: "The mountain disappeared into grey nothing above the rooftops."
All three methods transmit the same world fact. Choose your method based on the beat's mechanism and the prose profile's voice.

Given proposition: "Fang Yuan views other people as tools"
  • Through thought: His gaze swept over the crowd. Resources. Obstacles. Nothing between.
  • Through action: He stepped around the old woman without breaking stride.
  • Through dialogue: "They'll serve. Or they won't." He didn't look back.
The proposition is a belief-state to establish. HOW you establish it is craft.

CRITICAL: If a proposition contains figurative language and the prose profile forbids figures of speech, REWRITE the proposition as literal fact, then transmit that. "Smoke dances like spirits" becomes "Smoke rises in twisted columns" if metaphor is forbidden.
\n`
    : '';

  // Previous prose edge for transition continuity
  const adjacentProseBlock = prevProseEnding
    ? `PREVIOUS SCENE ENDING (match tone, avoid repeating imagery or phrasing):\n"""${prevProseEnding}"""`
    : '';

  const instruction = activePlan
    ? `Follow the beat plan sequence — each beat maps to a passage of prose. The mechanism defines the delivery MODE (dialogue, thought, action, etc). The propositions define STORY WORLD FACTS TO TRANSMIT (what the reader must come to believe is true). Your job is to weave both into compelling, voiced prose.

BEAT BOUNDARY MARKERS:
After completing the prose for each beat, insert a marker line on its own:
[BEAT_END:0]
[BEAT_END:1]
[BEAT_END:2]
...and so on for each beat in the plan (0-indexed).

These markers help track which prose came from which beat and will be removed from the final prose. Place them BETWEEN beats, not within paragraphs. Do NOT include a marker after the final beat.

Example structure for a 3-beat scene:
[Prose for beat 0...]

[BEAT_END:0]

[Prose for beat 1...]

[BEAT_END:1]

[Prose for beat 2...]

MECHANISMS define delivery mode:
- dialogue → a substantive EXCHANGE of quoted speech between characters. A dialogue beat is NOT a single line with a tag. Unfold it: at least 3–5 turns, distinct voices, subtext (what is NOT said), interruptions or silences that carry weight, non-verbal business (glances, gestures, pauses) interleaved between lines. Dialogue carries the bulk of the beat's word budget. A "dialogue" beat that resolves in one or two quoted sentences has failed the mechanism — either expand it into a real conversation or switch the mechanism. In dramatic registers, dialogue is where character and conflict live; treat it accordingly.

  WORKED EXAMPLE — beat: "Shen Lin confronts Meng Song about the missing ledger"

  FAILURE (one-line exchange, mechanism collapsed):
    Shen Lin demanded to know where the ledger was. "Don't play dumb," he said. Meng Song shrugged. "I have no idea what you're talking about."

  SUCCESS (multi-turn exchange, subtext, non-verbal business, distinct voices):
    "The ledger." Shen Lin didn't sit. He set his palms flat on the table, as though the wood might lie if he didn't hold it down. "The one from the eastern storehouse."
    Meng Song looked up from his tea. "You'll have to be more specific. I've signed off on four ledgers this week."
    "You know which one."
    "I know which one you've been losing sleep over." Meng Song tilted the cup, watched a leaf fold in on itself. "That's a different question."
    Silence. Outside, a guard's footfall receded down the corridor, then returned, paused, moved on.
    "If the inspector finds discrepancies —"
    "He won't." Meng Song set the cup down. His fingers were steady. "Because the ledger he sees will be the correct one." A small, almost fond smile. "I thought you trusted me, Shen Lin."
    Shen Lin's palms left marks on the wood. He didn't answer. He didn't need to.

  Notice the elements: each character has a distinct cadence (Shen Lin clipped, Meng Song elliptical); the subtext (accusation, evasion, power inversion) is carried by what is implied rather than stated; the non-verbal business (palms on table, the tea leaf, the footsteps outside, the withheld answer) does as much work as the quoted lines; the silence at the midpoint is a turn. THIS is a dialogue beat. Aim for this level of density and texture whenever dialogue is the declared mechanism — adapted, of course, to the prose profile's register and voice.
- thought → internal monologue, POV character's private reasoning
- action → physical movement, gesture, interaction with objects
- environment → setting, weather, sensory details of the space
- narration → authorial voice, rhetoric, time compression
- memory → flashback triggered by association
- document → embedded text (letter, sign, excerpt) shown literally
- comic → humor, irony, absurdity, undercut expectations

PROPOSITIONS are facts the scene must establish. The mode of transmission is dictated by the declared register:
- In dramatic-realist registers, prefer demonstration over verbatim assertion. Proposition: "Mist covers the village" → transmit via sensory detail (dampness on skin, visibility reduced), action (houses emerge from whiteness), or environment description — not as a flat declaration.
- In lyric, mythic, fabulist, aphoristic, omniscient, or essayistic registers, direct statement is legitimate and sometimes primary. "Mist covered the village, and the village stopped speaking of its dead." is a valid transmission in those registers.
- In declarative / expository registers (essay, research, memoir at distance), propositions can be stated, attributed, and grounded — "The research shows X" is the point, not a failure.
- The reader comes to hold the fact as true. How that holding is earned is register-dependent.

RHYTHM & VOICE — the prose profile is law; the defaults below apply only when the profile is silent:
- Where the profile specifies a rhythm (terse, flowing, periodic, cumulative, incantatory, monotonic-by-design, fragmented, staccato), obey the profile. Hemingway and Saramago have opposite rhythms and both are correct.
- Default (profile silent): vary sentence length — short for impact, long for flow, fragments for urgency; avoid inertial subject-verb-object patterns; front-load clauses, use appositives, embed dependent clauses.
- Match the register declared in the prose profile. In dramatic registers, avoid writing like technical documentation. In essayistic, scholarly, or reportorial registers, exposition IS the register — it is a failure only when it displaces a declared dramatic register.

SHOW, DON'T TELL — default for dramatic registers, adjustable by profile:
- In dramatic registers: prefer demonstration over explanation. Show fear through trembling hands, not "He felt fear". Demonstrate themes through events rather than declaring them. Reveal system knowledge through demonstration, dialogue discovery, or consequence rather than narrator exposition.
- In essayistic, mythic, oracular, auto-theoretical, omniscient, memoiristic, or oral-epic registers: narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools. Borges tells. Tolstoy's essay-chapters tell. Sebald tells. Rushdie's openings address the reader. When the profile declares such a register, "showing" is still earned through particulars (specific image, specific claim, specific citation), but the prohibition against direct statement is lifted.
- Universal across registers: vagueness is the real failure. "She felt something shift" is weak in every register; "She named the thing that shifted" is strong in reflective registers; "Her hands would not stop" is strong in dramatic registers. The test is specificity, not the verb.

THREE CONTINUITY CONSTRAINTS — the prose honours all three. The *mode* of honouring them is dictated by the declared register, not by a single craft doctrine:
1. WORLD: the POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established. (In dramatic registers this is "discovery through action"; in essayistic or omniscient registers it is "the narrator introduces it here for the first time, with evidence".)
2. THREADS: each thread shift lands at a specific moment in the scene. In dramatic registers that moment is usually dramatised through action; in reflective, essayistic, or lyric registers it may be named, stated, or imaged — whatever the profile calls for.
3. SYSTEM: new system concepts arrive with grounding — a demonstration, a citation, a consequence, a worked example, or a framing that earns them. What counts as "earning" is register-dependent.

BEAT SIZING — EACH BEAT IS A ~${WORDS_PER_BEAT}-WORD CHUNK OF PROSE. The plan was built on this convention: every beat is allocated roughly ${WORDS_PER_BEAT} words so beat weight stays consistent across the work.
- Write each beat at approximately ${WORDS_PER_BEAT} words of prose. A light beat may land at ~${Math.round(WORDS_PER_BEAT * 0.7)}; a dense dialogue or action beat with many propositions may stretch to ~${Math.round(WORDS_PER_BEAT * 1.3)}. Treat this as the rhythm budget, not a hard cap.
- The plan has already balanced proposition load across beats assuming this size. If a beat carries 4 propositions, it needs ~${WORDS_PER_BEAT} words to land all four with texture; compressing into 40 words will drop or flatten them. Expanding into 200 words will bloat the rhythm and push the scene long.
- Consistency matters. A ~${Math.round(WORDS_PER_BEAT * 0.5)}-word beat followed by a ~${WORDS_PER_BEAT * 2}-word beat reads as broken rhythm. Keep consecutive beats comparable in length unless the plan's mechanism/function explicitly calls for contrast.
- Brevity is still a virtue — do not pad to hit the target. If a beat can honestly deliver its propositions in fewer words, write fewer words. Just do not cut propositions to fit.

Satisfy every logical requirement and achieve every proposition in whatever mode the profile declares.

PROSE PROFILE COMPLIANCE: every sentence conforms to the voice, register, devices, and rules declared above. If the profile forbids figurative language, use zero figures of speech. If it requires specific devices, use them. The profile is the authorial voice — match it.`
    : `RHYTHM & VOICE — the prose profile is law; the defaults below apply only when the profile is silent:
- Where the profile specifies a rhythm, obey the profile. Register and stance from PROSE PROFILE above take precedence over the defaults here.
- Default (profile silent): vary sentence length, front-load clauses, use appositives, vary structure.
- Match the register declared in the prose profile. In dramatic registers, avoid documentation-tone. In essayistic or scholarly registers, exposition IS the register.

SHOW, DON'T TELL — default for dramatic registers, adjustable by profile:
- In dramatic registers: prefer demonstration over explanation — show through body language, action, dialogue subtext; demonstrate themes through events.
- In essayistic, mythic, oracular, omniscient, memoiristic, auto-theoretical, or oral-epic registers: narrator commentary, named emotion, direct thematic statement, and expository paragraphs are legitimate primary tools when the profile declares such a register.
- Universal across registers: vagueness is the real failure. Specificity — a named image, a named claim, a named source — is strong in every register.

THREE CONTINUITY CONSTRAINTS — the prose honours all three. The mode of honouring them is dictated by the declared register:
1. WORLD: the POV perceives only what its senses and existing knowledge allow. New world deltas arrive through specific moments in the scene; they are not referenced before they have been established.
2. THREADS: each thread shift lands at a specific moment in the scene. In dramatic registers the shift is usually dramatised; in reflective, essayistic, or lyric registers it may be named, stated, or imaged.
3. SYSTEM: new system concepts arrive with grounding appropriate to the register — demonstration, citation, consequence, worked example, or named framing.

Render every thread shift, world change, relationship delta, and system reveal in the mode the profile declares. Foreshadow through imagery, subtext, or explicit framing as the profile prefers.

BEAT SIZING — EVEN WITHOUT A PLAN, THINK IN ~${WORDS_PER_BEAT}-WORD BEATS. The scene should read as a sequence of beats of roughly consistent weight — one beat ≈ one paragraph or tight scene moment, ≈${WORDS_PER_BEAT} words. This keeps rhythm even and propositions evenly distributed. No fixed floor, no padding — but if you find a single beat running past ~${WORDS_PER_BEAT * 2} words, it is probably two beats.

OPENING TRANSITION — read the <time-gap> on the scene. Good storytelling weaves the passage of time into narrative texture so the reader always feels it without ever reading it as a timestamp or log entry. The gap size shifts how visible the weaving is, not whether it happens. MINOR jumps (concurrent, hours, same-day, multi-day): texture only — a candle now lit, light fallen low, a chair pushed back, a character visibly tired. NEVER write "X hours later" or "the next morning,". NOTABLE jumps (multi-week): weave a clearer signal through weather, a finished task, a small status change. Still texture, not statement. MAJOR jumps (multi-month): weight the opening with a re-anchor — status update, changed season, healed wound, matured plan; naming the elapsed time directly is permitted here when it carries narrative force. GENERATIONAL jumps (year+): must be marked with weight — montage, aged-up description, environmental change. Underplaying a generational jump reads as continuity error.

PROSE PROFILE COMPLIANCE: every sentence conforms to the declared voice, register, devices, and rules. If the profile forbids figures of speech, use zero. If it requires specific devices, use them.`;

  const prompt = `${profileSection ? `${profileSection}\n\n` : ''}${adjacentProseBlock ? `${adjacentProseBlock}\n\n` : ''}${planBlock}${sceneBlock}

${instruction}`;

  const reasoningBudget = REASONING_BUDGETS[narrative.storySettings?.reasoningLevel ?? 'low'] || undefined;

  // Helper: Generate raw prose from LLM
  const generateRaw = async (): Promise<string> => {
    if (onToken) {
      return callGenerateStream(prompt, systemPrompt, onToken, MAX_TOKENS_DEFAULT, 'generateSceneProse', WRITING_MODEL, reasoningBudget);
    }
    return callGenerate(prompt, systemPrompt, MAX_TOKENS_DEFAULT, 'generateSceneProse', WRITING_MODEL, reasoningBudget, false);
  };

  // Generation with retry on marker failure (max 2 attempts)
  const MAX_ATTEMPTS = 2;
  let result: { prose: string; beatProseMap?: BeatProseMap; markersFailed?: boolean } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rawProse = await generateRaw();

    // Parse beat boundaries if scene has a plan
    result = activePlan
      ? parseBeatProseMap(rawProse, activePlan.beats.length)
      : { prose: rawProse };

    // Success: markers valid or no plan to check
    if (!result.markersFailed || !activePlan) {
      break;
    }

    // Failure: markers invalid
    if (attempt < MAX_ATTEMPTS) {
      logWarning(`Beat markers failed on attempt ${attempt}/${MAX_ATTEMPTS}, retrying`, 'Prose generation returned invalid beat markers', {
        source: 'prose-generation',
        operation: 'generate-prose-with-beats',
        details: { attempt, maxAttempts: MAX_ATTEMPTS }
      });
    } else {
      logError(`Beat markers failed after ${MAX_ATTEMPTS} attempts`, 'Returning prose without beat mapping', {
        source: 'prose-generation',
        operation: 'generate-prose-with-beats',
        details: { maxAttempts: MAX_ATTEMPTS }
      });
    }
  }

  // Invariant: result must exist after loop
  if (!result) {
    throw new Error('[generateSceneProse] Internal error: no result after generation loop');
  }

  logInfo('Completed prose generation', {
    source: 'prose-generation',
    operation: 'generate-prose-complete',
    details: {
      narrativeId: narrative.id,
      sceneId: scene.id,
      proseLength: result.prose.length,
      hasBeatMap: !!result.beatProseMap,
      beatChunks: result.beatProseMap?.chunks.length ?? 0,
      markersFailed: result.markersFailed ?? false,
    },
  });

  // ── Generate prose embedding ─────────────────────────────────────────────
  const { generateEmbeddings } = await import('@/lib/embeddings');

  let proseEmbedding: number[] | undefined;
  if (result.prose && result.prose.length > 0) {
    const embeddings = await generateEmbeddings([result.prose], narrative.id);
    proseEmbedding = embeddings[0];
  }

  return { ...result, proseEmbedding };
}

// ── Shared Helpers ───────────────────────────────────────────────────────────

/** Sanitize hallucinated IDs in generated scenes — filter out invalid references instead of crashing. */
export function sanitizeScenes(scenes: Scene[], narrative: NarrativeState, label: string): void {
  const validCharIds = new Set(Object.keys(narrative.characters));
  const validLocIds = new Set(Object.keys(narrative.locations));
  const validThreadIds = new Set(Object.keys(narrative.threads));
  // Pre-compute the union of SYS node ids across the whole batch so that a
  // scene-2 edge referencing a scene-1 SYS-GEN-* id is not treated as orphaned.
  // The later concept-resolution pass in generateScenes remaps those GEN ids
  // to real SYS-XX ids using a cumulative map.
  const batchSysNodeIds = new Set<string>(Object.keys(narrative.systemGraph?.nodes ?? {}));
  for (const s of scenes) {
    for (const n of s.systemDeltas?.addedNodes ?? []) {
      if (n?.id) batchSysNodeIds.add(n.id);
    }
  }
  const validArtifactIds = new Set(Object.keys(narrative.artifacts ?? {}));
  const allEntityIds = new Set([...validCharIds, ...validLocIds, ...validArtifactIds]);
  const stripped: string[] = [];
  const fallbackCharId = Object.keys(narrative.characters)[0];

  // ── First pass: register introduced entities across every scene ──
  // Must happen BEFORE reference validation so that participantIds /
  // povId / worldDeltas / etc. referencing a freshly-introduced entity
  // don't get stripped as "invalid".
  for (const scene of scenes) {
    if (Array.isArray(scene.newCharacters)) {
      const seenInScene = new Set<string>();
      scene.newCharacters = scene.newCharacters.filter((c) => {
        if (!c.id || !c.name || !c.role) {
          stripped.push(`newCharacter missing required fields in scene ${scene.id}`);
          return false;
        }
        if (validCharIds.has(c.id)) {
          stripped.push(`newCharacter "${c.id}" collides with existing character in scene ${scene.id}`);
          return false;
        }
        if (seenInScene.has(c.id)) {
          stripped.push(`newCharacter "${c.id}" duplicated within scene ${scene.id} — second occurrence dropped`);
          return false;
        }
        seenInScene.add(c.id);
        return true;
      }).map((c) => {
        const validRoles: Character['role'][] = ['anchor', 'recurring', 'transient'];
        const role: Character['role'] = validRoles.includes(c.role)
          ? c.role
          : 'transient';
        if (role !== c.role) {
          stripped.push(`newCharacter "${c.id}" role coerced to "transient" in scene ${scene.id}`);
        }
        const world = c.world ?? { nodes: {}, edges: [] };
        if (Object.keys(world.nodes).length === 0) {
          stripped.push(`newCharacter "${c.id}" introduced with empty world in scene ${scene.id}`);
        }
        const cleaned: Character = {
          id: c.id,
          name: c.name,
          role,
          threadIds: c.threadIds ?? [],
          world,
          ...(c.imagePrompt ? { imagePrompt: c.imagePrompt } : {}),
          ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
        };
        return cleaned;
      });
      for (const c of scene.newCharacters) {
        validCharIds.add(c.id);
        allEntityIds.add(c.id);
      }
      if (scene.newCharacters.length === 0) delete scene.newCharacters;
    }
    if (Array.isArray(scene.newLocations)) {
      const seenInScene = new Set<string>();
      scene.newLocations = scene.newLocations.filter((l) => {
        if (!l.id || !l.name) {
          stripped.push(`newLocation missing required fields in scene ${scene.id}`);
          return false;
        }
        if (validLocIds.has(l.id)) {
          stripped.push(`newLocation "${l.id}" collides with existing location in scene ${scene.id}`);
          return false;
        }
        if (seenInScene.has(l.id)) {
          stripped.push(`newLocation "${l.id}" duplicated within scene ${scene.id} — second occurrence dropped`);
          return false;
        }
        seenInScene.add(l.id);
        if (l.parentId && !validLocIds.has(l.parentId)) {
          stripped.push(`newLocation "${l.id}" has invalid parentId "${l.parentId}" in scene ${scene.id}`);
          l.parentId = null;
        }
        return true;
      }).map((l) => {
        const legacy = l as LocationEntity & { prominence?: string };
        const validProminences: LocationProminence[] = ['domain', 'place', 'margin'];
        const prominence: LocationProminence = validProminences.includes(legacy.prominence as LocationProminence)
          ? (legacy.prominence as LocationProminence)
          : 'place';
        if (prominence !== legacy.prominence) {
          stripped.push(`newLocation "${l.id}" prominence coerced to "place" in scene ${scene.id}`);
        }
        const world = l.world ?? { nodes: {}, edges: [] };
        if (Object.keys(world.nodes).length === 0) {
          stripped.push(`newLocation "${l.id}" introduced with empty world in scene ${scene.id}`);
        }
        const cleaned: LocationEntity = {
          id: l.id,
          name: l.name,
          prominence,
          parentId: l.parentId ?? null,
          tiedCharacterIds: l.tiedCharacterIds ?? [],
          threadIds: l.threadIds ?? [],
          world,
          ...(l.imagePrompt ? { imagePrompt: l.imagePrompt } : {}),
          ...(l.imageUrl ? { imageUrl: l.imageUrl } : {}),
        };
        return cleaned;
      });
      for (const l of scene.newLocations!) {
        validLocIds.add(l.id);
        allEntityIds.add(l.id);
      }
      if (scene.newLocations!.length === 0) delete scene.newLocations;
    }
    if (Array.isArray(scene.newArtifacts)) {
      const seenInScene = new Set<string>();
      scene.newArtifacts = scene.newArtifacts.filter((a) => {
        if (!a.id || !a.name) {
          stripped.push(`newArtifact missing required fields in scene ${scene.id}`);
          return false;
        }
        if (validArtifactIds.has(a.id)) {
          stripped.push(`newArtifact "${a.id}" collides with existing artifact in scene ${scene.id}`);
          return false;
        }
        if (seenInScene.has(a.id)) {
          stripped.push(`newArtifact "${a.id}" duplicated within scene ${scene.id} — second occurrence dropped`);
          return false;
        }
        seenInScene.add(a.id);
        return true;
      }).map((a) => {
        const validSignificances: Artifact['significance'][] = ['key', 'notable', 'minor'];
        const significance: Artifact['significance'] = validSignificances.includes(a.significance)
          ? a.significance
          : 'minor';
        if (significance !== a.significance) {
          stripped.push(`newArtifact "${a.id}" significance coerced to "minor" in scene ${scene.id}`);
        }
        const world = a.world ?? { nodes: {}, edges: [] };
        if (Object.keys(world.nodes).length === 0) {
          stripped.push(`newArtifact "${a.id}" introduced with empty world in scene ${scene.id}`);
        }
        const cleaned: Artifact = {
          id: a.id,
          name: a.name,
          significance,
          parentId: a.parentId ?? null,
          threadIds: a.threadIds ?? [],
          world,
          ...(a.imagePrompt ? { imagePrompt: a.imagePrompt } : {}),
          ...(a.imageUrl ? { imageUrl: a.imageUrl } : {}),
        };
        return cleaned;
      });
      for (const a of scene.newArtifacts) {
        validArtifactIds.add(a.id);
        allEntityIds.add(a.id);
      }
      if (scene.newArtifacts.length === 0) delete scene.newArtifacts;
    }
    if (Array.isArray(scene.newThreads)) {
      const seenInScene = new Set<string>();
      scene.newThreads = scene.newThreads.filter((t) => {
        if (!t.id || !t.description) {
          stripped.push(`newThread missing required fields in scene ${scene.id}`);
          return false;
        }
        if (validThreadIds.has(t.id)) {
          stripped.push(`newThread "${t.id}" collides with existing thread in scene ${scene.id}`);
          return false;
        }
        if (seenInScene.has(t.id)) {
          stripped.push(`newThread "${t.id}" duplicated within scene ${scene.id} — second occurrence dropped`);
          return false;
        }
        seenInScene.add(t.id);
        return true;
      }).map((t) => {
        // ThreadParticipant only has {id, type}. Canonicalise to drop any
        // extra fields the LLM emits (e.g. a phantom `role` left over from
        // prior schema drafts) and filter against the right entity set per
        // anchor type so dangling ids never reach the narrative.
        const validParticipants = (t.participants ?? []).flatMap((p) => {
          const ok =
            (p.type === 'character' && validCharIds.has(p.id)) ||
            (p.type === 'location' && validLocIds.has(p.id)) ||
            (p.type === 'artifact' && validArtifactIds.has(p.id));
          if (!ok) {
            stripped.push(`newThread "${t.id}" participant ${p.type} "${p.id}" in scene ${scene.id}`);
            return [];
          }
          return [{ id: p.id, type: p.type }];
        });
        // ThreadLog normalisation — the LLM sometimes returns the wrong
        // shape (edges as object, nodes as array). Replace the malformed
        // side with canonical empty; log so the drop isn't silent.
        const rawNodes = t.threadLog?.nodes;
        const nodesValid = rawNodes && typeof rawNodes === 'object' && !Array.isArray(rawNodes);
        const rawEdges = t.threadLog?.edges;
        const edgesValid = Array.isArray(rawEdges);
        if (rawNodes !== undefined && !nodesValid) {
          stripped.push(`newThread "${t.id}" threadLog.nodes malformed in scene ${scene.id} — replaced with {}`);
        }
        if (rawEdges !== undefined && !edgesValid) {
          stripped.push(`newThread "${t.id}" threadLog.edges malformed in scene ${scene.id} — replaced with []`);
        }
        // Outcomes default to binary yes/no if missing — the absolute
        // minimum valid market. LLM-supplied multi-outcome arrays pass
        // through after dedup + trim.
        const rawOutcomes = Array.isArray(t.outcomes)
          ? Array.from(new Set(t.outcomes.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)))
          : [];
        const outcomes = rawOutcomes.length >= 2 ? rawOutcomes : ['yes', 'no'];
        if (rawOutcomes.length < 2) {
          stripped.push(`newThread "${t.id}" outcomes invalid in scene ${scene.id} — defaulted to ["yes", "no"]`);
        }
        const rawPriorProbs = Array.isArray(
          (t as { priorProbs?: unknown }).priorProbs,
        )
          ? ((t as { priorProbs?: unknown }).priorProbs as unknown[]).map((v) =>
              typeof v === 'number' ? v : NaN,
            )
          : undefined;
        const seedBelief = newNarratorBelief(outcomes.length, 2, rawPriorProbs);
        return {
          id: t.id,
          description: t.description,
          outcomes,
          beliefs: {
            [NARRATOR_AGENT_ID]: { ...seedBelief, lastTouchedScene: scene.id },
          },
          participants: validParticipants,
          openedAt: t.openedAt ?? scene.id,
          dependents: t.dependents ?? [],
          threadLog: {
            nodes: nodesValid ? (rawNodes as Thread['threadLog']['nodes']) : {},
            edges: edgesValid ? (rawEdges as Thread['threadLog']['edges']) : [],
          },
        } satisfies Thread;
      });
      for (const t of scene.newThreads) {
        validThreadIds.add(t.id);
      }
      if (scene.newThreads.length === 0) delete scene.newThreads;
    }
  }

  // ── Between passes: validate cross-entity refs on newly-introduced
  // entities. All entity + thread IDs are registered in the valid sets by
  // now, so threadIds / tiedCharacterIds / parentId / internal world.edges
  // can be checked against the combined (existing + batch-introduced) set.
  const pruneWorldEdges = (
    world: { nodes: Record<string, unknown>; edges: { from: string; to: string }[] },
    label: string,
    sceneId: string,
  ) => {
    const before = world.edges.length;
    const nodeIds = new Set(Object.keys(world.nodes));
    world.edges = world.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    if (world.edges.length < before) {
      stripped.push(`${label} world edges (${before - world.edges.length}) reference missing nodes in scene ${sceneId}`);
    }
  };
  for (const scene of scenes) {
    for (const c of scene.newCharacters ?? []) {
      c.threadIds = c.threadIds.filter((tid) => {
        if (validThreadIds.has(tid)) return true;
        stripped.push(`newCharacter "${c.id}" threadId "${tid}" in scene ${scene.id}`);
        return false;
      });
      pruneWorldEdges(c.world, `newCharacter "${c.id}"`, scene.id);
    }
    for (const l of scene.newLocations ?? []) {
      l.threadIds = l.threadIds.filter((tid) => {
        if (validThreadIds.has(tid)) return true;
        stripped.push(`newLocation "${l.id}" threadId "${tid}" in scene ${scene.id}`);
        return false;
      });
      l.tiedCharacterIds = l.tiedCharacterIds.filter((cid) => {
        if (validCharIds.has(cid)) return true;
        stripped.push(`newLocation "${l.id}" tiedCharacterId "${cid}" in scene ${scene.id}`);
        return false;
      });
      pruneWorldEdges(l.world, `newLocation "${l.id}"`, scene.id);
    }
    for (const a of scene.newArtifacts ?? []) {
      a.threadIds = a.threadIds.filter((tid) => {
        if (validThreadIds.has(tid)) return true;
        stripped.push(`newArtifact "${a.id}" threadId "${tid}" in scene ${scene.id}`);
        return false;
      });
      // Artifact parent is a character, a location, or null (world-owned).
      // Anything else is a hallucination — clear to null rather than keeping
      // a dangling reference that breaks ownership chains downstream.
      if (a.parentId != null && !validCharIds.has(a.parentId) && !validLocIds.has(a.parentId)) {
        stripped.push(`newArtifact "${a.id}" parentId "${a.parentId}" in scene ${scene.id}`);
        a.parentId = null;
      }
      pruneWorldEdges(a.world, `newArtifact "${a.id}"`, scene.id);
    }
    for (const t of scene.newThreads ?? []) {
      // Dependents reference OTHER threads. Validated here (not in first
      // pass) because cross-scene newThreads need to be registered first.
      t.dependents = t.dependents.filter((tid) => {
        if (tid === t.id) {
          stripped.push(`newThread "${t.id}" dependent self-loop in scene ${scene.id}`);
          return false;
        }
        if (validThreadIds.has(tid)) return true;
        stripped.push(`newThread "${t.id}" dependent "${tid}" in scene ${scene.id}`);
        return false;
      });
      // threadLog nodes — drop entries missing required fields.
      const nodeIds = new Set(Object.keys(t.threadLog.nodes));
      for (const [nodeId, node] of Object.entries(t.threadLog.nodes)) {
        if (!node || typeof node.content !== 'string' || !node.content.trim() || typeof node.type !== 'string') {
          stripped.push(`newThread "${t.id}" threadLog node "${nodeId}" missing fields in scene ${scene.id}`);
          delete t.threadLog.nodes[nodeId];
          nodeIds.delete(nodeId);
        }
      }
      // threadLog edges must reference threadLog nodes on the same thread.
      const beforeEdges = t.threadLog.edges.length;
      t.threadLog.edges = t.threadLog.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
      if (t.threadLog.edges.length < beforeEdges) {
        stripped.push(`newThread "${t.id}" threadLog edges (${beforeEdges - t.threadLog.edges.length}) reference missing log nodes in scene ${scene.id}`);
      }
    }
  }

  for (const scene of scenes) {
    if (!scene.locationId || !validLocIds.has(scene.locationId)) {
      stripped.push(`locationId "${scene.locationId}" in scene ${scene.id}`);
      scene.locationId = Object.keys(narrative.locations)[0];
    }
    if (!Array.isArray(scene.participantIds)) scene.participantIds = [];
    if (!Array.isArray(scene.events)) scene.events = [];
    if (!scene.povId || !validCharIds.has(scene.povId)) {
      if (scene.povId) stripped.push(`povId "${scene.povId}" in scene ${scene.id} (invalid)`);
      scene.povId = scene.participantIds.find((pid) => validCharIds.has(pid)) ?? fallbackCharId;
    }
    const validParticipants = scene.participantIds.filter((pid) => {
      if (validCharIds.has(pid)) return true;
      stripped.push(`participantId "${pid}" in scene ${scene.id}`);
      return false;
    });
    // A character introduced in this scene is, by definition, participating
    // in it — otherwise the LLM wouldn't have grounds to introduce them. If
    // the LLM omitted them from participantIds, splice them in rather than
    // leaving the scene with a dangling newCharacter that never appears.
    for (const c of scene.newCharacters ?? []) {
      if (!validParticipants.includes(c.id)) {
        validParticipants.push(c.id);
        stripped.push(`newCharacter "${c.id}" auto-added to participantIds in scene ${scene.id}`);
      }
    }
    scene.participantIds = validParticipants.length > 0 ? validParticipants : [fallbackCharId];
    if (!scene.participantIds.includes(scene.povId)) {
      scene.povId = scene.participantIds[0] ?? fallbackCharId;
    }
    if (!Array.isArray(scene.threadDeltas)) scene.threadDeltas = [];
    if (!Array.isArray(scene.worldDeltas)) scene.worldDeltas = [];
    if (!Array.isArray(scene.relationshipDeltas)) scene.relationshipDeltas = [];
    // Market-delta validation: threadId must exist in the narrative (or be a
    // newThread introduced earlier in this batch), outcomes in each update
    // must match the thread's outcome list, and evidence must be integer in
    // [MIN, MAX]. Invalid outcomes / updates get stripped; empty deltas drop.
    scene.threadDeltas = scene.threadDeltas.filter((tm) => {
      if (validThreadIds.has(tm.threadId)) return true;
      stripped.push(`threadId "${tm.threadId}" in scene ${scene.id}`);
      return false;
    });
    const validLogTypes = new Set<ThreadLogNodeType>([
      'pulse', 'transition', 'setup', 'escalation', 'payoff', 'twist', 'callback', 'resistance', 'stall',
    ]);
    scene.threadDeltas = scene.threadDeltas.filter((tm) => {
      // Resolve thread shape — either pre-existing or freshly introduced in this batch.
      const existing = narrative.threads[tm.threadId];
      const introduced = scenes
        .flatMap((s) => s.newThreads ?? [])
        .find((nt) => nt.id === tm.threadId);
      const threadOutcomes: string[] = existing?.outcomes ?? introduced?.outcomes ?? ['yes', 'no'];
      const allowed = new Set(threadOutcomes);

      // logType default + validation.
      if (!tm.logType || !validLogTypes.has(tm.logType as ThreadLogNodeType)) {
        stripped.push(`threadDelta "${tm.threadId}" invalid logType="${tm.logType}" in scene ${scene.id} — defaulted to "pulse"`);
        tm.logType = 'pulse';
      }

      // Outcome expansion — validate addOutcomes BEFORE update sanitization so
      // updates referencing newly-added outcomes pass the 'allowed' check.
      // Closed threads reject expansion; duplicates filtered.
      const isClosed = !!existing?.closedAt;
      const rawAdd = Array.isArray(tm.addOutcomes) ? tm.addOutcomes : [];
      const extended: string[] = [];
      if (rawAdd.length > 0) {
        if (isClosed) {
          stripped.push(`threadDelta "${tm.threadId}" addOutcomes rejected — thread is closed, in scene ${scene.id}`);
        } else {
          const seen = new Set(threadOutcomes.map((o) => o.toLowerCase()));
          for (const raw of rawAdd) {
            const name = typeof raw === 'string' ? raw.trim() : '';
            if (!name) {
              stripped.push(`threadDelta "${tm.threadId}" addOutcomes contained empty entry in scene ${scene.id}`);
              continue;
            }
            if (seen.has(name.toLowerCase())) {
              stripped.push(`threadDelta "${tm.threadId}" addOutcome "${name}" duplicates existing outcome in scene ${scene.id}`);
              continue;
            }
            seen.add(name.toLowerCase());
            extended.push(name);
            allowed.add(name);
          }
        }
        tm.addOutcomes = extended.length > 0 ? extended : undefined;
      } else {
        delete tm.addOutcomes;
      }

      // Normalize updates: filter invalid outcomes, clamp evidence.
      const rawUpdates = Array.isArray(tm.updates) ? tm.updates : [];
      tm.updates = rawUpdates.flatMap((u) => {
        if (!u || typeof u.outcome !== 'string' || !allowed.has(u.outcome)) {
          stripped.push(`threadDelta "${tm.threadId}" update outcome "${u?.outcome}" not in ${[...allowed].join('|')} in scene ${scene.id}`);
          return [];
        }
        const ev = typeof u.evidence === 'number' ? clampEvidence(u.evidence) : 0;
        return [{ outcome: u.outcome, evidence: ev }];
      });

      // volumeDelta defaults to 0 if missing.
      tm.volumeDelta = typeof tm.volumeDelta === 'number' ? tm.volumeDelta : 0;

      // rationale — require non-empty string; synthesise fallback if empty.
      if (typeof tm.rationale !== 'string' || !tm.rationale.trim()) {
        const desc = existing?.description ?? tm.threadId;
        tm.rationale = `Thread "${desc}" [${tm.logType}] — no rationale provided.`;
        stripped.push(`threadDelta "${tm.threadId}" missing rationale in scene ${scene.id} — synthesized fallback`);
      }

      // Drop entirely empty deltas (no updates, no volume, no new outcomes).
      const addCount = tm.addOutcomes?.length ?? 0;
      if (tm.updates.length === 0 && tm.volumeDelta === 0 && addCount === 0 && tm.logType === 'pulse') {
        stripped.push(`threadDelta "${tm.threadId}" empty (no updates, no volume, no expansion, pulse) in scene ${scene.id} — dropped`);
        return false;
      }
      return true;
    });
    scene.worldDeltas = scene.worldDeltas.filter((km) => {
      if (!km.entityId) {
        stripped.push(`worldDelta missing entityId in scene ${scene.id}`);
        return false;
      }
      if (allEntityIds.has(km.entityId)) return true;
      stripped.push(`worldDelta entityId "${km.entityId}" in scene ${scene.id}`);
      return false;
    });
    scene.relationshipDeltas = scene.relationshipDeltas.filter((rm) => {
      if (rm.from === rm.to) {
        stripped.push(`relationshipDelta self-loop "${rm.from}" in scene ${scene.id}`);
        return false;
      }
      if (validCharIds.has(rm.from) && validCharIds.has(rm.to)) return true;
      stripped.push(`relationshipDelta "${rm.from}" -> "${rm.to}" in scene ${scene.id}`);
      return false;
    });
    scene.ownershipDeltas = (scene.ownershipDeltas ?? []).filter((om) => {
      // fromId/toId can be null per schema (artifact introduced from nowhere
      // or discarded to nowhere). Only validate non-null ids against the
      // known entity set.
      const fromOk = om.fromId === null || allEntityIds.has(om.fromId);
      const toOk = om.toId === null || allEntityIds.has(om.toId);
      const ok = validArtifactIds.has(om.artifactId) && fromOk && toOk;
      if (!ok) stripped.push(`ownershipDelta "${om.artifactId}" in scene ${scene.id}`);
      return ok;
    });
    if (scene.ownershipDeltas.length === 0) delete scene.ownershipDeltas;
    // Validate artifact usages — artifact must exist, character must be a participant,
    // character-owned artifacts can only be used by their owner, location-owned are communal
    scene.artifactUsages = (scene.artifactUsages ?? []).filter((au) => {
      if (!validArtifactIds.has(au.artifactId)) { stripped.push(`artifactUsage artifact "${au.artifactId}" in scene ${scene.id}`); return false; }
      if (au.characterId && !validCharIds.has(au.characterId)) { stripped.push(`artifactUsage character "${au.characterId}" in scene ${scene.id}`); return false; }
      const artifact = narrative.artifacts[au.artifactId];
      // Character-owned artifacts can only be used by their owner; location-owned and world-owned (null) are communal
      if (artifact && artifact.parentId && au.characterId && narrative.characters[artifact.parentId] && artifact.parentId !== au.characterId) {
        stripped.push(`artifactUsage "${au.characterId}" cannot use character-owned artifact "${au.artifactId}" (owned by ${artifact.parentId}) in scene ${scene.id}`);
        return false;
      }
      return true;
    });
    if (scene.artifactUsages.length === 0) delete scene.artifactUsages;
    scene.tieDeltas = (scene.tieDeltas ?? []).filter((mm) => {
      const ok = validLocIds.has(mm.locationId) && validCharIds.has(mm.characterId) &&
                 (mm.action === 'add' || mm.action === 'remove');
      if (!ok) stripped.push(`tieDelta "${mm.characterId}" at "${mm.locationId}" in scene ${scene.id}`);
      return ok;
    });
    if (scene.tieDeltas.length === 0) delete scene.tieDeltas;
    if (scene.characterMovements) {
      const sanitized: Record<string, { locationId: string; transition: string }> = {};
      for (const [charId, mv] of Object.entries(scene.characterMovements)) {
        const movement = typeof mv === 'string' ? { locationId: mv, transition: '' } : mv;
        if (!validCharIds.has(charId)) { stripped.push(`characterMovement charId "${charId}" in scene ${scene.id}`); continue; }
        if (!validLocIds.has(movement.locationId)) { stripped.push(`characterMovement locationId "${movement.locationId}" in scene ${scene.id}`); continue; }
        sanitized[charId] = movement;
      }
      scene.characterMovements = Object.keys(sanitized).length > 0 ? sanitized : undefined;
    }

    // (Introduced entities — newCharacters / newLocations / newArtifacts /
    // newThreads — were registered in the first pass above so reference
    // validation earlier in this loop could see them.)

    // Sanitize systemDeltas — ensure arrays exist, nodes have concept+type,
    // edges have valid refs, no self-loops, no intra-scene duplicates.
    if (scene.systemDeltas) {
      const sysDelta = scene.systemDeltas;
      const beforeNodes = (sysDelta.addedNodes ?? []).length;
      const beforeEdges = (sysDelta.addedEdges ?? []).length;
      // Ensure each node carries an id (LLM may omit when emitting arrays) so
      // sanitize's field check doesn't spuriously drop them. IDs here are
      // still GEN-* placeholders — downstream remapping assigns real ones.
      sysDelta.addedNodes = (sysDelta.addedNodes ?? []).map((n, idx) => ({
        ...n,
        id: n.id || `SYS-GEN-${idx}`,
      }));
      for (const n of sysDelta.addedNodes) {
        if (n?.id) batchSysNodeIds.add(n.id);
      }
      // Valid targets for edges: any SYS-GEN id anywhere in the batch plus
      // existing graph ids — edges can legitimately cross scene boundaries.
      sanitizeSystemDelta(sysDelta, batchSysNodeIds, new Set<string>());
      if (sysDelta.addedNodes.length < beforeNodes) {
        stripped.push(`system nodes (${beforeNodes - sysDelta.addedNodes.length}) missing concept/type in scene ${scene.id}`);
      }
      if (sysDelta.addedEdges.length < beforeEdges) {
        stripped.push(`system edges (${beforeEdges - sysDelta.addedEdges.length}) invalid/self-loop/dup in scene ${scene.id}`);
      }
    } else {
      scene.systemDeltas = { addedNodes: [], addedEdges: [] };
    }
    // Ensure worldDeltas have required fields. Node ORDER defines
    // the chain — no explicit edges are stored. Type sanitization in applyWorldDelta.
    scene.worldDeltas = scene.worldDeltas.filter((km) => {
      if (!km.entityId) { stripped.push(`worldDelta missing entityId in scene ${scene.id}`); return false; }
      km.addedNodes = (km.addedNodes ?? []).filter((n, idx) => {
        const ok = !!n?.content;
        if (!ok) {
          stripped.push(`worldDelta "${km.entityId}" addedNode[${idx}] empty/malformed in scene ${scene.id}`);
        }
        return ok;
      });
      if (km.addedNodes.length === 0) {
        stripped.push(`worldDelta empty (no nodes) in scene ${scene.id}`);
        return false;
      }
      return true;
    });
  }
  if (stripped.length > 0) {
    logWarning(`Stripped ${stripped.length} hallucinated ID(s) from ${label}`, stripped.join(', '), {
      source: 'manual-generation',
      operation: 'clean-scene-data',
      details: { count: stripped.length, type: label }
    });
  }
}


