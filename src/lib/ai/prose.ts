import type { NarrativeState, Scene, ProseScore } from '@/types/narrative';
import { callGenerate, callGenerateStream, SYSTEM_PROMPT } from './api';
import { WRITING_MODEL, ANALYSIS_MODEL } from '@/lib/constants';
import { parseJson } from './json';
import { sceneContext, deriveLogicRules, sceneScale } from './context';



export async function scoreSceneProse(
  narrative: NarrativeState,
  scene: Scene,
  currentProse: string,
): Promise<ProseScore> {
  const sceneBlock = sceneContext(narrative, scene);
  const logicRules = deriveLogicRules(narrative, scene);

  const logicBlock = logicRules.length > 0
    ? `\nLOGICAL CONSTRAINTS (check all are satisfied):\n${logicRules.map((r) => `  - ${r}`).join('\n')}\n`
    : '';

  const systemPrompt = `You are a literary editor grading prose quality. You return ONLY valid JSON — no markdown, no commentary.`;

  const prompt = `SCENE CONTEXT:
${sceneBlock}
${logicBlock}

CURRENT PROSE:
${currentProse}

Score the prose on these 6 dimensions (1-10 each):
- voice: POV discipline, character distinctiveness, consistent narrative voice
- pacing: scene breathes, deliveries land with proper weight, no rushing or dragging
- dialogue: subtext-rich, character-specific speech patterns, no filler exchanges
- sensory: grounded in concrete physical detail, body-first interiority
- mutationCoverage: all thread shifts, knowledge changes, and relationship mutations are dramatised (not summarised)
- overall: holistic quality considering all dimensions

For each dimension, provide a brief critique (1-2 sentences) explaining the score — what works and what doesn't.

Return JSON:
{
  "score": {
    "overall": 7,
    "voice": 8,
    "pacing": 6,
    "dialogue": 7,
    "sensory": 5,
    "mutationCoverage": 8
  },
  "critique": "Voice (8): Strong POV lock on Kael, distinct internal rhythm. Pacing (6): The middle sags — the market confrontation needs tighter deliveries. Dialogue (7): Subtext works in the alley scene but the tavern exchange feels expository. Sensory (5): Too much telling of emotions, not enough physical grounding. Mutation coverage (8): Thread shifts land well. Overall (7): Solid foundation but the sensory and pacing weaknesses hold it back."
}`;

  const raw = await callGenerate(prompt, systemPrompt, 2000, 'scoreSceneProse', ANALYSIS_MODEL);
  const parsed = parseJson(raw, 'scoreSceneProse') as Record<string, unknown>;

  // Handle both {score: {...}, critique: "..."} and flat {overall: 7, voice: 8, ..., critique: "..."} shapes
  const scoreObj = (parsed.score && typeof parsed.score === 'object' ? parsed.score : parsed) as Record<string, unknown>;
  const critique = (typeof parsed.critique === 'string' ? parsed.critique : typeof (scoreObj as Record<string, unknown>).critique === 'string' ? (scoreObj as Record<string, unknown>).critique : undefined) as string | undefined;

  return {
    overall: Number(scoreObj.overall) || 0,
    voice: Number(scoreObj.voice) || 0,
    pacing: Number(scoreObj.pacing) || 0,
    dialogue: Number(scoreObj.dialogue) || 0,
    sensory: Number(scoreObj.sensory) || 0,
    mutationCoverage: Number(scoreObj.mutationCoverage ?? scoreObj.mutation_coverage) || 0,
    critique,
  };
}

export async function rewriteSceneProse(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  currentProse: string,
  analysis: string,
  /** How many past scenes' full prose to include (0 = last paragraph only) */
  contextPast = 0,
  /** How many future scenes' full prose to include (0 = first paragraph only) */
  contextFuture = 0,
  /** Specific scene IDs to include as reference context (for distant chapters) */
  referenceSceneIds?: string[],
  /** Stream prose tokens as they arrive */
  onToken?: (token: string) => void,
): Promise<{ prose: string; changelog: string }> {
  const sceneIdx = resolvedKeys.indexOf(scene.id);
  const sceneBlock = sceneContext(narrative, scene);
  const logicRules = deriveLogicRules(narrative, scene);

  // Get neighboring prose for continuity
  let prevEnding: string | null = null;
  let nextOpening: string | null = null;
  let neighborContext = '';

  const hasExpandedContext = contextPast > 0 || contextFuture > 0;

  // Past scenes
  if (contextPast > 0) {
    const prevScenes: string[] = [];
    for (let i = 1; i <= contextPast; i++) {
      const pIdx = sceneIdx - i;
      if (pIdx < 0) break;
      const pId = resolvedKeys[pIdx];
      const pScene = pId ? narrative.scenes[pId] : null;
      if (pScene?.prose) {
        const pov = narrative.characters[pScene.povId]?.name ?? pScene.povId;
        const loc = narrative.locations[pScene.locationId]?.name ?? pScene.locationId;
        prevScenes.unshift(`--- SCENE ${pIdx + 1} (POV: ${pov}, @${loc}) ---\n${pScene.summary}\n\n${pScene.prose}`);
      }
    }
    if (prevScenes.length > 0) {
      neighborContext += `\nPRECEDING SCENES (${prevScenes.length} scene${prevScenes.length > 1 ? 's' : ''} before — read these to understand what has already happened):\n${prevScenes.join('\n\n')}\n`;
    }
  }

  // Future scenes
  if (contextFuture > 0) {
    const nextScenes: string[] = [];
    for (let i = 1; i <= contextFuture; i++) {
      const nIdx = sceneIdx + i;
      if (nIdx >= resolvedKeys.length) break;
      const nId = resolvedKeys[nIdx];
      const nScene = nId ? narrative.scenes[nId] : null;
      if (nScene?.prose) {
        const pov = narrative.characters[nScene.povId]?.name ?? nScene.povId;
        const loc = narrative.locations[nScene.locationId]?.name ?? nScene.locationId;
        nextScenes.push(`--- SCENE ${nIdx + 1} (POV: ${pov}, @${loc}) ---\n${nScene.summary}\n\n${nScene.prose}`);
      }
    }
    if (nextScenes.length > 0) {
      neighborContext += `\nFOLLOWING SCENES (${nextScenes.length} scene${nextScenes.length > 1 ? 's' : ''} after — read these to understand what must be set up):\n${nextScenes.join('\n\n')}\n`;
    }
  }

  // Default: ±1 paragraph (300 chars) when no expanded context
  if (!hasExpandedContext) {
    const prevId = sceneIdx > 0 ? resolvedKeys[sceneIdx - 1] : null;
    const nextId = sceneIdx < resolvedKeys.length - 1 ? resolvedKeys[sceneIdx + 1] : null;
    const prevProse = prevId ? narrative.scenes[prevId]?.prose : null;
    const nextProse = nextId ? narrative.scenes[nextId]?.prose : null;
    prevEnding = prevProse ? prevProse.split(/\n\n+/).slice(-1)[0]?.slice(-300) : null;
    nextOpening = nextProse ? nextProse.split(/\n\n+/)[0]?.slice(0, 300) : null;
  }

  // Pinned reference scenes (distant chapters selected by the author)
  if (referenceSceneIds && referenceSceneIds.length > 0) {
    const refBlocks = referenceSceneIds
      .filter((id) => id !== scene.id)
      .map((id) => {
        const refScene = narrative.scenes[id];
        if (!refScene?.prose) return null;
        const idx = resolvedKeys.indexOf(id);
        const pov = narrative.characters[refScene.povId]?.name ?? refScene.povId;
        const loc = narrative.locations[refScene.locationId]?.name ?? refScene.locationId;
        return `--- SCENE ${idx + 1} [pinned reference] (POV: ${pov}, @${loc}) ---\n${refScene.summary}\n\n${refScene.prose}`;
      })
      .filter(Boolean);
    if (refBlocks.length > 0) {
      neighborContext += `\nPINNED REFERENCE SCENES (selected by the author — these are not adjacent but contain relevant context for this rewrite):\n${refBlocks.join('\n\n')}\n`;
    }
  }

  const logicBlock = logicRules.length > 0
    ? `\nLOGICAL CONSTRAINTS (all must be satisfied):\n${logicRules.map((r) => `  - ${r}`).join('\n')}\n`
    : '';

  const systemPrompt = `You are a literary editor and prose writer. Your task is to REWRITE prose based on the provided analysis. You return ONLY valid JSON — no markdown, no commentary.

Voice & style for the rewrite:
- Third-person limited, locked to the POV character's senses and interiority.
- Prose should feel novelistic, not summarised. Dramatise through action, dialogue, and sensory texture.
- Favour subtext over exposition. Let tension live in what characters don't say.
- Match the tone and genre of the world: ${narrative.worldSummary.slice(0, 200)}.
- Use straight quotes (" and '), never smart/curly quotes.
- CRITICAL: Do NOT open with weather, atmosphere, scent, or environmental description.
- Do NOT end with philosophical musings, rhetorical questions, or atmospheric fade-outs.`
  + (narrative.storySettings?.proseVoice?.trim()
    ? `\n\nAUTHOR VOICE (mimic this style — it overrides the defaults above):\n${narrative.storySettings.proseVoice.trim()}`
    : '');

  const neighborBlock = neighborContext
    || `${prevEnding ? `\nPREVIOUS SCENE ENDING:\n"...${prevEnding}"\n` : ''}${nextOpening ? `\nNEXT SCENE OPENING:\n"${nextOpening}..."\n` : ''}`;

  const prompt = `SCENE CONTEXT:
${sceneBlock}
${logicBlock}${neighborBlock}

CURRENT PROSE:
${currentProse}

ANALYSIS / CRITIQUE TO ADDRESS:
${analysis}

Rewrite the prose to FULLY ADDRESS every point in the analysis above. The analysis describes specific changes that MUST be implemented — do not merely acknowledge them cosmetically. If the analysis says a character should leave, they must leave in the prose. If it says an event should be removed, remove it entirely. If it says a detail should be added, add it concretely. The rewrite is not a polish pass — it is a structural edit guided by the analysis.

Preserve narrative deliveries, events, and plot points that the analysis does NOT ask you to change. Length should match the scene's needs — a quiet scene may be 800 words, a dense convergence scene 3000+. Err on the side of brevity for delivery; never pad. Do not artificially compress or expand — let the content dictate length.${hasExpandedContext ? '\n\nYou have been given the FULL PROSE of neighboring scenes. Use this to ensure continuity — character state, spatial positions, injuries, emotional beats, and knowledge must flow consistently across scene boundaries. Do not repeat beats that already occurred in preceding scenes, and set up what following scenes expect.' : ''}

${onToken ? 'Write the full rewritten prose directly — no JSON, no markdown, no commentary. Start with the first word of the scene.' : 'Return JSON:\n{\n  "prose": "the full rewritten prose text"\n}'}`;

  const scale = sceneScale(scene);
  let prose: string;
  if (onToken) {
    const rawStream = await callGenerateStream(prompt, systemPrompt, onToken, scale.proseTokens, 'rewriteSceneProse', WRITING_MODEL);
    // LLM may ignore "no JSON" instruction — extract prose if it returned JSON
    prose = rawStream;
  } else {
    const raw = await callGenerate(prompt, systemPrompt, scale.proseTokens + 500, 'rewriteSceneProse', WRITING_MODEL);
    const parsed = parseJson(raw, 'rewriteSceneProse') as { prose: string };
    prose = parsed.prose;
  }

  // Generate changelog in a separate cheap call — diffing old vs new
  let changelog = '';
  try {
    const changelogRaw = await callGenerate(
      `ANALYSIS ADDRESSED:\n${analysis.slice(0, 500)}\n\nSummarize the key changes between the original and rewritten prose in 3-5 SHORT bullet points. Each bullet: one sentence, no quotes, just describe the change plainly. Focus on structural and continuity changes, not word-level edits.\n\nExample format:\n• Moved Chi Shan's death to the opening to establish it immediately\n• Added Tie Ruo Nan's departure via the false trail before Fang Yuan loots\n• Removed duplicate arrival description that repeated the prior scene\n\nReturn JSON:\n{"changelog": "• bullet 1\\n• bullet 2\\n• bullet 3"}`,
      'You are a literary editor writing a brief change summary. Return ONLY valid JSON.',
      800,
      'rewriteChangelog',
      ANALYSIS_MODEL,
    );
    const changelogParsed = parseJson(changelogRaw, 'rewriteChangelog') as { changelog: unknown };
    // Handle both string and structured formats — LLM may return an array of objects
    const raw = changelogParsed.changelog;
    if (typeof raw === 'string') {
      changelog = raw;
    } else if (Array.isArray(raw)) {
      changelog = raw.map((item: unknown) => {
        if (typeof item === 'string') return `• ${item}`;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, string>;
          return `• ${obj.original ? `"${obj.original}" → ` : ''}${obj.rewritten ? `"${obj.rewritten}"` : ''}${obj.why ? ` — ${obj.why}` : obj.reason ? ` — ${obj.reason}` : ''}`;
        }
        return '';
      }).filter(Boolean).join('\n');
    } else {
      changelog = String(raw ?? '');
    }
  } catch {
    // Changelog generation is non-critical — don't fail the rewrite
  }

  return { prose: prose, changelog };
}

export async function scoreAndRewriteSceneProse(
  narrative: NarrativeState,
  scene: Scene,
  resolvedKeys: string[],
  currentProse: string,
): Promise<{ prose: string; changelog: string; score: ProseScore }> {
  const score = await scoreSceneProse(narrative, scene, currentProse);
  const result = await rewriteSceneProse(narrative, scene, resolvedKeys, currentProse, score.critique ?? 'General polish pass — improve all dimensions.');
  return { score, ...result };
}

export type ChartAnnotation = {
  sceneIndex: number;
  force: 'payoff' | 'change' | 'knowledge';
  label: string;
};

export async function generateChartAnnotations(
  narrative: NarrativeState,
  forceData: { sceneIndex: number; sceneId: string; arcName: string; forces: { payoff: number; change: number; knowledge: number }; corner: string; summary: string; threadChanges: string[]; location: string; participants: string[] }[],
): Promise<ChartAnnotation[]> {
  const trajectoryLines = forceData.map((d) => {
    const tc = d.threadChanges.length > 0 ? ` | ${d.threadChanges.join('; ')}` : '';
    return `[${d.sceneIndex + 1}] ${d.arcName} | ${d.corner} | P:${d.forces.payoff.toFixed(2)} C:${d.forces.change.toFixed(2)} V:${d.forces.knowledge.toFixed(2)} | @${d.location} | ${d.participants.join(', ')} | "${d.summary.slice(0, 80)}"${tc}`;
  }).join('\n');

  const systemPrompt = `You are a narrative analyst annotating force trajectory charts. Return ONLY valid JSON — no markdown, no code fences, no commentary.`;

  const prompt = `Analyze this narrative's force trajectory and generate annotations for notable moments.

NARRATIVE: "${narrative.title}" (${forceData.length} scenes)

SCENE-BY-SCENE DATA:
${trajectoryLines}

Annotate ONLY the peaks (local maxima) and troughs (local minima) of each force line. Look at the P/C/V values — find where each force hits its highest and lowest points, then label those.

Rules:
- ONLY peaks and troughs — nothing in between. If the value is rising or falling but hasn't reached an extremum, skip it.
- Include annotations for ALL THREE forces — payoff, change, AND variety
- ~4-6 annotations per force (the clearest peaks and troughs only)
- Labels: 2-5 words, specific to the story. Use character names, places, events.
- Never use generic labels like "high tension" or "calm period"
- Payoff peaks: danger, threats, betrayals. Troughs: safety, calm
- Change peaks: action bursts, dense reveals. Troughs: breathing room, reflection
- Knowledge peaks: new locations or characters (check @location and participants for first appearances). Troughs: same familiar cast/setting recurring

Return a JSON array:
[{"sceneIndex": 0, "force": "payoff", "label": "short annotation"}, ...]

sceneIndex is 0-based. force is one of: "payoff", "change", "knowledge".`;

  const raw = await callGenerate(prompt, SYSTEM_PROMPT, 4000, 'generateChartAnnotations', ANALYSIS_MODEL);

  // Parse JSON from response, handling potential markdown fences
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (a: unknown): a is ChartAnnotation =>
      typeof a === 'object' && a !== null &&
      'sceneIndex' in a && 'force' in a && 'label' in a &&
      typeof (a as ChartAnnotation).sceneIndex === 'number' &&
      ['payoff', 'change', 'knowledge'].includes((a as ChartAnnotation).force) &&
      typeof (a as ChartAnnotation).label === 'string'
  );
}
