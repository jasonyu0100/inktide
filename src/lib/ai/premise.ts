import { callGenerate, SYSTEM_PROMPT } from './api';
import { GENERATE_MODEL } from '@/lib/constants';
import { parseJson } from './json';

// ── Types ────────────────────────────────────────────────────────────────────

export type PremiseEntityType = 'character' | 'location' | 'thread';

export type PremiseEntity = {
  id: string;
  type: PremiseEntityType;
  name: string;
  description: string;
  role?: 'anchor' | 'recurring' | 'transient'; // characters only
  participantNames?: string[]; // threads only
};

export type PremiseEdge = {
  from: string;
  to: string;
  label: string;
};

export type PremiseChoice = {
  id: string;
  label: string;
  description: string;
};

export type PremiseQuestion = {
  text: string;
  context: string;
  choices: PremiseChoice[];
};

export type PremiseDecision = {
  question: string;
  answer: string;
};

export type PremiseQuestionResult = {
  question: PremiseQuestion;
  newEntities: PremiseEntity[];
  newEdges: PremiseEdge[];
  newRules: string[];
  title: string;
  worldSummary: string;
};

// ── System prompt ────────────────────────────────────────────────────────────

const PREMISE_SYSTEM = `You are a world architect helping a writer craft a narrative premise through Socratic questioning. Your goal is to draw out a rich, specific, conflict-laden world by asking one focused question at a time.

Each question should:
- Offer 3-4 choices that take the world in meaningfully different directions
- Go deeper as the conversation progresses — start broad (genre, tone, scale) then drill into specifics (characters, conflicts, systems, locations, threads)
- Never repeat a topic already established
- Each choice should be vivid and specific, not generic

As you process each answer, extract concrete entities (characters, locations, narrative threads) that have been established or strongly implied. Build the world incrementally.`;

// ── Generate next question ───────────────────────────────────────────────────

export async function generatePremiseQuestion(
  seed: string,
  decisions: PremiseDecision[],
  entities: PremiseEntity[],
  edges: PremiseEdge[],
  rules: string[],
  currentTitle: string,
): Promise<PremiseQuestionResult> {
  const round = decisions.length + 1;

  // Build decision history
  const historyBlock = decisions.length > 0
    ? `DECISIONS SO FAR:\n${decisions.map((d, i) => `${i + 1}. Q: ${d.question}\n   A: ${d.answer}`).join('\n')}`
    : 'No decisions yet — this is the opening question.';

  // Build entity inventory
  const chars = entities.filter(e => e.type === 'character');
  const locs = entities.filter(e => e.type === 'location');
  const threads = entities.filter(e => e.type === 'thread');

  const inventoryBlock = entities.length > 0
    ? `CURRENT WORLD INVENTORY:
Characters (${chars.length}): ${chars.map(c => `${c.name} — ${c.description}`).join('; ') || 'none'}
Locations (${locs.length}): ${locs.map(l => `${l.name} — ${l.description}`).join('; ') || 'none'}
Threads (${threads.length}): ${threads.map(t => `${t.name} — ${t.description}`).join('; ') || 'none'}
Rules (${rules.length}): ${rules.join('; ') || 'none'}
Edges: ${edges.map(e => `${e.from} → ${e.to}: ${e.label}`).join('; ') || 'none'}`
    : 'No entities established yet.';

  // Guidance based on round number
  const phaseGuidance = round <= 2
    ? 'PHASE: Foundation. Ask about genre, tone, setting, or the central premise. Keep it broad.'
    : round <= 4
    ? 'PHASE: Structure. Ask about the protagonist, central conflict, power dynamics, or the world\'s defining system/mechanic. Start naming characters and locations.'
    : round <= 6
    ? 'PHASE: Depth. Ask about relationships, secrets, factions, specific locations, or narrative threads. Flesh out what exists.'
    : 'PHASE: Refinement. Ask about specific tensions, rules, edge cases, or underexplored aspects. Fill gaps in the world.';

  // What's thin?
  const gaps: string[] = [];
  if (chars.length < 2 && round > 2) gaps.push('Few characters — consider asking about key figures');
  if (locs.length < 2 && round > 3) gaps.push('Few locations — consider asking about geography');
  if (threads.length < 1 && round > 3) gaps.push('No narrative threads — consider asking about tensions or open questions');
  if (rules.length < 1 && round > 4) gaps.push('No world rules — consider asking about constraints or laws');

  const prompt = `${seed ? `SEED CONCEPT: ${seed}\n\n` : ''}${historyBlock}

${inventoryBlock}

ROUND: ${round}
${phaseGuidance}
${gaps.length > 0 ? `\nGAPS TO ADDRESS:\n${gaps.map(g => `- ${g}`).join('\n')}` : ''}
${currentTitle ? `WORKING TITLE: ${currentTitle}` : ''}

Ask ONE question with 3-4 choices. Also extract any NEW entities, edges, and rules crystallized by the most recent answer (if any). Update the title and world summary.

Return JSON:
{
  "question": {
    "text": "the question",
    "context": "1-sentence why this matters for the world",
    "choices": [
      {"id": "a", "label": "short label (3-5 words)", "description": "1-sentence elaboration"},
      {"id": "b", "label": "...", "description": "..."},
      {"id": "c", "label": "...", "description": "..."}
    ]
  },
  "newEntities": [
    {"id": "char-1", "type": "character", "name": "Name", "description": "brief", "role": "anchor|recurring|transient"},
    {"id": "loc-1", "type": "location", "name": "Name", "description": "brief"},
    {"id": "thread-1", "type": "thread", "name": "Thread name", "description": "the tension", "participantNames": ["Name1", "Name2"]}
  ],
  "newEdges": [
    {"from": "char-1", "to": "loc-1", "label": "lives in"}
  ],
  "newRules": ["rule text"],
  "title": "Suggested Title",
  "worldSummary": "2-3 sentence world description incorporating all decisions so far"
}

Rules for entities:
- Only return NEW entities crystallized by the LATEST answer. Don't repeat existing ones.
- Entity IDs: use char-N, loc-N, thread-N format, continuing from existing counts.
- Edges can reference any entity ID (existing or new).
- newRules, newEntities, newEdges can be empty arrays if the latest answer didn't crystallize anything concrete yet.
- For round 1 (no decisions yet), return empty arrays for entities/edges/rules.`;

  const raw = await callGenerate(prompt, PREMISE_SYSTEM, undefined, 'premiseQuestion', GENERATE_MODEL);
  const parsed = parseJson(raw, 'premiseQuestion') as PremiseQuestionResult;

  return {
    question: parsed.question,
    newEntities: parsed.newEntities ?? [],
    newEdges: parsed.newEdges ?? [],
    newRules: parsed.newRules ?? [],
    title: parsed.title ?? currentTitle,
    worldSummary: parsed.worldSummary ?? '',
  };
}

// ── Build premise text ───────────────────────────────────────────────────────

export function buildPremiseText(
  entities: PremiseEntity[],
  rules: string[],
  worldSummary: string,
): { premise: string; characters: { name: string; role: string; description: string }[]; locations: { name: string; description: string }[]; threads: { description: string; participantNames: string[] }[]; rules: string[] } {
  const chars = entities.filter(e => e.type === 'character');
  const locs = entities.filter(e => e.type === 'location');
  const threads = entities.filter(e => e.type === 'thread');

  const parts: string[] = [worldSummary];

  if (chars.length > 0) {
    parts.push(`\nKey characters:\n${chars.map(c => `  - ${c.name} (${c.role ?? 'recurring'}): ${c.description}`).join('\n')}`);
  }
  if (locs.length > 0) {
    parts.push(`\nKey locations:\n${locs.map(l => `  - ${l.name}: ${l.description}`).join('\n')}`);
  }
  if (threads.length > 0) {
    parts.push(`\nNarrative threads:\n${threads.map(t => `  - ${t.name}: ${t.description}${t.participantNames?.length ? ` (involves: ${t.participantNames.join(', ')})` : ''}`).join('\n')}`);
  }
  if (rules.length > 0) {
    parts.push(`\nWorld rules (absolute constraints the narrative must obey):\n${rules.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}`);
  }

  return {
    premise: parts.join('\n'),
    characters: chars.map(c => ({ name: c.name, role: c.role ?? 'recurring', description: c.description })),
    locations: locs.map(l => ({ name: l.name, description: l.description })),
    threads: threads.map(t => ({ description: t.description, participantNames: t.participantNames ?? [] })),
    rules,
  };
}
