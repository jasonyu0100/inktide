#!/usr/bin/env npx tsx
/**
 * analyze-chapter.ts — Analyze a single chapter .txt file and extract narrative elements.
 *
 * Uses the same methodology as src/lib/ai.ts (branchContext, generateScenes):
 * - Full cumulative world state passed as context (characters with knowledge graphs,
 *   locations with hierarchy, threads with status lifecycle, relationships with valence)
 * - Full scene history from prior chapters with all mutations
 * - Contextual knowledge types (not generic "knows"/"secret")
 * - Thread lifecycle: dormant → surfacing → escalating → threatened → critical → resolved/subverted/done
 * - Pacing-aware scene extraction
 *
 * Usage:
 *   npx tsx scripts/analyze-chapter.ts <book-dir> <chapter-num> [--model <model>]
 *
 * Expects:  <book-dir>/chapters/chapter-01.txt, chapter-02.txt, ...
 * Outputs:  <book-dir>/analysis/chapter-01.json, chapter-02.json, ...
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { THREAD_ACTIVE_STATUSES, THREAD_TERMINAL_STATUSES, THREAD_STATUS_LABELS } from '../src/types/narrative';

config({ path: join(__dirname, '..', '.env.local') });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

// ── Parse args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/analyze-chapter.ts <book-dir> <chapter-num> [--model <model>]');
  process.exit(1);
}

const bookDir = args[0];
const chapterNum = parseInt(args[1], 10);
const modelIdx = args.indexOf('--model');
const model = modelIdx !== -1 ? args[modelIdx + 1] : DEFAULT_MODEL;

const chapterFile = join(bookDir, 'chapters', `chapter-${String(chapterNum).padStart(2, '0')}.txt`);
const analysisDir = join(bookDir, 'analysis');
const outputFile = join(analysisDir, `chapter-${String(chapterNum).padStart(2, '0')}.json`);

if (!existsSync(chapterFile)) {
  console.error(`Chapter file not found: ${chapterFile}`);
  process.exit(1);
}

mkdirSync(analysisDir, { recursive: true });

// ── Build cumulative world state (mirrors ai.ts branchContext) ──────────────
function buildCumulativeContext(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ChapterData = any;

  const allChapters: ChapterData[] = [];
  for (let i = 1; i < chapterNum; i++) {
    const f = join(analysisDir, `chapter-${String(i).padStart(2, '0')}.json`);
    if (existsSync(f)) allChapters.push({ chapter: i, ...JSON.parse(readFileSync(f, 'utf-8')) });
  }
  if (allChapters.length === 0) return '';

  // ── Characters with full knowledge graph ──
  const characters: Record<string, {
    name: string; role: string;
    knowledge: { type: string; content: string; chapter: number }[];
  }> = {};

  // ── Locations with hierarchy ──
  const locations: Record<string, {
    name: string; parentName: string | null; description: string;
    lore: string[];
  }> = {};

  // ── Threads with full status history ──
  const threads: Record<string, {
    description: string; anchorNames: string[];
    currentStatus: string; history: string[];
  }> = {};

  // ── Relationships (latest state) ──
  const relationships: Record<string, {
    from: string; to: string; type: string; valence: number;
  }> = {};

  // ── Full scene history (mirrors branchContext scene history) ──
  const sceneHistory: string[] = [];
  let sceneCounter = 0;

  for (const ch of allChapters) {
    // Characters
    for (const c of ch.characters ?? []) {
      if (!characters[c.name]) {
        characters[c.name] = { name: c.name, role: c.role, knowledge: [] };
      }
      const rank: Record<string, number> = { transient: 0, recurring: 1, anchor: 2 };
      if ((rank[c.role] ?? 0) > (rank[characters[c.name].role] ?? 0)) {
        characters[c.name].role = c.role;
      }
      for (const k of c.knowledge ?? []) {
        characters[c.name].knowledge.push({ type: k.type, content: k.content, chapter: ch.chapter });
      }
    }

    // Locations
    for (const loc of ch.locations ?? []) {
      if (!locations[loc.name]) {
        locations[loc.name] = {
          name: loc.name, parentName: loc.parentName,
          description: loc.description, lore: loc.lore ?? [],
        };
      }
    }

    // Threads
    for (const t of ch.threads ?? []) {
      const key = t.description;
      if (!threads[key]) {
        threads[key] = {
          description: t.description, anchorNames: t.anchorNames,
          currentStatus: t.statusAtEnd,
          history: [`Ch${ch.chapter}: ${t.statusAtStart} → ${t.statusAtEnd}`],
        };
      } else {
        threads[key].currentStatus = t.statusAtEnd;
        threads[key].history.push(`Ch${ch.chapter}: ${t.statusAtStart} → ${t.statusAtEnd}`);
      }
    }

    // Relationships
    for (const r of ch.relationships ?? []) {
      relationships[`${r.from}→${r.to}`] = r;
    }

    // Scene history (full, like branchContext — location, participants, mutations, summary)
    for (const scene of ch.scenes ?? []) {
      sceneCounter++;
      const threadChanges = (scene.threadMutations ?? [])
        .map((tm: any) => `${tm.threadDescription?.slice(0, 50)}: ${tm.from}→${tm.to}`)
        .join('; ');
      const kChanges = (scene.knowledgeMutations ?? [])
        .map((km: any) => `${km.characterName} learned [${km.type}]: ${km.content}`)
        .join('; ');
      const rChanges = (scene.relationshipMutations ?? [])
        .map((rm: any) => `${rm.from}→${rm.to}: ${rm.type} (${rm.valenceDelta >= 0 ? '+' : ''}${rm.valenceDelta})`)
        .join('; ');

      sceneHistory.push(
        `[Ch${ch.chapter} S${sceneCounter}] @ ${scene.locationName} | POV: ${scene.povName ?? scene.participantNames?.[0] ?? '?'} | ${scene.participantNames?.join(', ')}` +
        (threadChanges ? ` | Threads: ${threadChanges}` : '') +
        (kChanges ? ` | Knowledge: ${kChanges}` : '') +
        (rChanges ? ` | Relationships: ${rChanges}` : '') +
        `\n   ${scene.summary}`
      );
    }
  }

  // ── Assemble context (same structure as branchContext in ai.ts) ──
  const charBlock = Object.values(characters).map(c => {
    const kLines = c.knowledge.map(k => `    (${k.type}) ${k.content} [Ch${k.chapter}]`);
    return `- ${c.name} (${c.role})${kLines.length > 0 ? '\n  Knowledge:\n' + kLines.join('\n') : ''}`;
  }).join('\n');

  const locBlock = Object.values(locations).map(l => {
    const loreLines = l.lore.map(lr => `    ${lr}`);
    return `- ${l.name}${l.parentName ? ` (inside ${l.parentName})` : ''}: ${l.description}` +
      (loreLines.length > 0 ? '\n  Lore:\n' + loreLines.join('\n') : '');
  }).join('\n');

  const threadBlock = Object.values(threads).map(t =>
    `- "${t.description}" [${t.currentStatus}] anchors: ${t.anchorNames.join(', ')} | history: ${t.history.join(', ')}`
  ).join('\n');

  const relBlock = Object.values(relationships).map(r =>
    `- ${r.from} → ${r.to}: ${r.type} (valence: ${r.valence})`
  ).join('\n');

  return `
CUMULATIVE WORLD STATE (${allChapters.length} chapters analyzed):

CHARACTERS:
${charBlock}

LOCATIONS:
${locBlock}

THREADS:
${threadBlock}

RELATIONSHIPS:
${relBlock}

FULL SCENE HISTORY (${sceneCounter} scenes across ${allChapters.length} chapters):
${sceneHistory.join('\n')}`;
}

// ── Call LLM (with retry + backoff) ──────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BACKOFF = [5000, 15000, 30000]; // ms

async function callLLM(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set in .env.local');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = RETRY_BACKOFF[attempt - 1] ?? 30000;
      console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }

    console.log(`  Calling ${model}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}...`);
    const start = Date.now();

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Narrative Engine - Chapter Analyzer',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 32000,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        const status = res.status;
        // Retry on rate limit or server errors
        if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
          console.warn(`  HTTP ${status} — will retry`);
          continue;
        }
        throw new Error(`OpenRouter error (${status}): ${err}`);
      }

      const data = await res.json();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  Done in ${elapsed}s (${data.usage?.total_tokens ?? '?'} tokens)`);

      const content = data.choices?.[0]?.message?.content ?? '';
      if (!content) {
        if (attempt < MAX_RETRIES) { console.warn('  Empty response — will retry'); continue; }
        throw new Error('LLM returned empty response');
      }
      return content;
    } catch (err: any) {
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
        if (attempt < MAX_RETRIES) { console.warn(`  Network error (${err.code}) — will retry`); continue; }
      }
      throw err;
    }
  }
  throw new Error('Exhausted all retries');
}

// ── JSON extraction & repair ─────────────────────────────────────────────────
function extractJSON(raw: string): string {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');

  // Find the outermost JSON object if surrounded by prose
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  // Remove trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, '$1');

  // Attempt to repair truncated JSON (unclosed brackets/braces)
  let opens = 0, closes = 0, sqOpens = 0, sqCloses = 0;
  for (const ch of text) {
    if (ch === '{') opens++;
    else if (ch === '}') closes++;
    else if (ch === '[') sqOpens++;
    else if (ch === ']') sqCloses++;
  }
  // Close unclosed structures
  while (sqCloses < sqOpens) { text += ']'; sqCloses++; }
  while (closes < opens) { text += '}'; closes++; }

  return text;
}

// ── Validation ───────────────────────────────────────────────────────────────
function validate(parsed: any, sectionCount: number): string[] {
  const errors: string[] = [];

  if (!parsed.chapterSummary) errors.push('Missing chapterSummary');
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    errors.push('No scenes returned');
    return errors;
  }

  const allSections = new Set<number>();
  for (let i = 0; i < parsed.scenes.length; i++) {
    const s = parsed.scenes[i];
    if (!s.summary) errors.push(`Scene ${i + 1}: missing summary`);
    if (!s.povName) errors.push(`Scene ${i + 1}: missing povName`);
    if (!Array.isArray(s.events) || s.events.length === 0) errors.push(`Scene ${i + 1}: missing events`);
    if (!Array.isArray(s.sections) || s.sections.length === 0) {
      errors.push(`Scene ${i + 1}: missing sections array`);
    } else {
      for (const n of s.sections) {
        if (typeof n !== 'number' || n < 1 || n > sectionCount) {
          errors.push(`Scene ${i + 1}: invalid section number ${n} (valid: 1-${sectionCount})`);
        }
        if (allSections.has(n)) errors.push(`Scene ${i + 1}: section ${n} is duplicated across scenes`);
        allSections.add(n);
      }
    }
  }

  // Check for missing sections
  const missing: number[] = [];
  for (let i = 1; i <= sectionCount; i++) {
    if (!allSections.has(i)) missing.push(i);
  }
  if (missing.length > 0) errors.push(`Sections not covered by any scene: ${missing.join(', ')}`);

  return errors;
}

// ── Section splitting ────────────────────────────────────────────────────────
const TARGET_SECTIONS = 12; // Aim for ~12 sections per chapter, adapts to chapter size

function splitIntoSections(text: string): { numbered: string; sections: string[] } {
  // Try paragraph-based splitting first (double newline separated)
  let chunks = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  // If few paragraph breaks, split by sentences instead (handles single-newline wrapped text)
  if (chunks.length < 6) {
    // Join all lines into continuous text, then split on sentence boundaries
    const continuous = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = continuous.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [continuous];

    // Group sentences into roughly TARGET_SECTIONS chunks
    const sentencesPerChunk = Math.max(1, Math.round(sentences.length / TARGET_SECTIONS));
    chunks = [];
    for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
      chunks.push(sentences.slice(i, i + sentencesPerChunk).join('').trim());
    }
  } else {
    // Group paragraphs into TARGET_SECTIONS chunks
    const parasPerSection = Math.max(1, Math.round(chunks.length / TARGET_SECTIONS));
    const grouped: string[] = [];
    for (let i = 0; i < chunks.length; i += parasPerSection) {
      grouped.push(chunks.slice(i, i + parasPerSection).join('\n\n'));
    }
    chunks = grouped;
  }

  // Format numbered sections for the LLM
  const numbered = chunks.map((s, i) => `[SECTION ${i + 1}]\n${s}`).join('\n\n');

  return { numbered, sections: chunks };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const chapterText = readFileSync(chapterFile, 'utf-8');
  const cumulativeCtx = buildCumulativeContext();
  const { numbered, sections } = splitIntoSections(chapterText);

  console.log(`\nAnalyzing Chapter ${chapterNum} (${chapterText.split(/\s+/).length} words, ${sections.length} sections)`);
  if (cumulativeCtx) console.log(`  With cumulative state from ${chapterNum - 1} prior chapter(s)`);

  const systemPrompt = `You are a narrative simulation engine that extracts structured scene data from book chapters for an interactive storytelling system.
You must ALWAYS respond with valid JSON only — no markdown, no explanation, no code fences.

The narrative engine tracks:
- Characters with roles (anchor = central, recurring = frequent, transient = minor) and knowledge graphs
- Locations with parent-child hierarchy and lore/secrets
- Narrative threads — ongoing tensions that evolve: ${THREAD_ACTIVE_STATUSES.join(' → ')} → ${THREAD_TERMINAL_STATUSES.join('/')}
- Scenes with POV character, events, thread mutations, knowledge mutations, and relationship mutations
- Relationships — directional with sentiment valence (-1 to 1) and descriptive type

Knowledge types must be SPECIFIC and CONTEXTUAL — not generic labels like "knows" or "secret". Use types that describe exactly what kind of knowledge: "social_observation", "class_awareness", "romantic_longing", "moral_judgment", "hidden_wealth_source", "past_betrayal", "forbidden_desire", "strategic_deception", etc.

Be thorough. Extract every character, location, and narrative development from the chapter text.`;

  const prompt = `Analyze this chapter and extract all narrative elements.
${cumulativeCtx}

=== CHAPTER ${chapterNum} TEXT (${sections.length} sections) ===
${numbered}

Return a single JSON object with this exact structure:
{
  "chapterSummary": "2-3 sentence summary of key events and thematic significance",
  "characters": [
    {
      "name": "Full Name",
      "role": "anchor|recurring|transient",
      "firstAppearance": true/false,
      "knowledge": [
        {
          "type": "specific_contextual_type (e.g. social_observation, romantic_longing, moral_judgment, hidden_identity, strategic_deception)",
          "content": "What they learn, reveal, or demonstrate in THIS chapter"
        }
      ]
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "parentName": "Parent Location or null",
      "description": "Brief atmospheric description",
      "lore": ["Notable detail, symbolic significance, or secret about this place"]
    }
  ],
  "threads": [
    {
      "description": "The narrative question or tension — use EXACT description from prior chapters for continuing threads",
      "anchorNames": ["Character or location names this thread is anchored to"],
      "statusAtStart": "status at chapter start (MUST match current status from THREADS section above)",
      "statusAtEnd": "status at chapter end",
      "development": "How this thread developed in this chapter"
    }
  ],
  "scenes": [
    {
      "locationName": "Where it happens",
      "povName": "Name of the POV character for this scene",
      "participantNames": ["Who is present"],
      "events": ["short_event_tag_1", "short_event_tag_2"],
      "summary": "2-4 sentence vivid summary in present tense, literary style. Describe what happens, who is involved, and the emotional stakes.",
      "sections": [1, 2, 3],
      "threadMutations": [
        { "threadDescription": "exact thread description", "from": "status", "to": "status" }
      ],
      "knowledgeMutations": [
        { "characterName": "Name", "action": "added", "content": "What they learned", "type": "specific_contextual_type" }
      ],
      "relationshipMutations": [
        { "from": "Name", "to": "Name", "type": "Description of how the relationship shifted", "valenceDelta": -0.3 to 0.3 }
      ]
    }
  ],
  "relationships": [
    {
      "from": "Name",
      "to": "Name",
      "type": "Descriptive relationship from 'from's perspective — written in character voice",
      "valence": -1 to 1
    }
  ]
}

RULES:
- Break the chapter into 2-5 distinct scenes based on location shifts, time jumps, or major tonal changes
- Every scene MUST have a non-empty "summary" (2-4 vivid sentences), at least one event tag, and a "povName" (the character whose perspective the scene is told from)
- "sections" is an array of section numbers (1-indexed) that this scene covers. The chapter text above is pre-split into ${sections.length} numbered sections. Each scene must reference which sections it spans. Together, all scenes should cover all sections. Sections must not overlap between scenes.

CUMULATIVE CONTINUITY (critical):
- Thread "statusAtStart" MUST match the thread's current status from the THREADS section in the world state above. Do NOT reset or skip statuses.
- If a character is listed in CHARACTERS above, set firstAppearance: false
- Reuse EXACT thread descriptions from prior chapters when the same thread continues. Only create new threads for genuinely new narrative tensions introduced in THIS chapter.
- Relationship valence should evolve from prior values — check RELATIONSHIPS above. Use valenceDelta in scene mutations to show incremental change (typically ±0.1 to ±0.2).
- When listing relationships at the chapter level, show the UPDATED valence (prior + accumulated deltas from this chapter's scenes)

KNOWLEDGE MUTATIONS:
- Knowledge tracks INFORMATION ASYMMETRY — what one character knows that others don't, or revelations that change a character's behavior/beliefs. It is NOT a log of every observation.
- For POV/narrator characters: only record knowledge that creates dramatic irony (they know something another character doesn't), changes their worldview, or represents a genuine discovery. Do NOT log routine observations, general atmosphere, or plot events they merely witness.
- For non-POV characters: record secrets they hold, lies they tell, information they reveal or conceal, and beliefs that drive their actions.
- Each entry should pass the test: "Would the story change if this character didn't know this?"
- Types must be contextual: "class_awareness", "romantic_longing", "moral_judgment", "hidden_wealth_source", "past_relationship", "strategic_deception", "disillusionment", "complicity_in_crime", etc.

THREAD LIFECYCLE:
- Active statuses: ${THREAD_ACTIVE_STATUSES.map((s: string) => `"${s}"`).join(', ')}
- Terminal statuses: ${THREAD_TERMINAL_STATUSES.map((s: string) => `"${s}" (${THREAD_STATUS_LABELS[s]})`).join(', ')}
- Threads should evolve gradually. A dormant thread surfaces slowly, not in one jump to critical.
- When a thread's storyline has concluded, transition to appropriate terminal status.

PACING:
- Not every scene is a major plot event. Include quieter scenes: character moments, atmosphere, social observation.
- Vary rhythm — a tense scene should be followed by a breather.
- Only 1 in 3 scenes should be a significant plot beat.`;

  const MAX_VALIDATION_RETRIES = 2;
  let lastErrors: string[] | undefined;

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const currentPrompt = attempt === 0
      ? prompt
      : prompt + `\n\nPREVIOUS ATTEMPT HAD ERRORS — please fix:\n${lastErrors!.map(e => `- ${e}`).join('\n')}`;

    const raw = await callLLM(currentPrompt, systemPrompt);
    const json = extractJSON(raw);

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      const errFile = outputFile.replace('.json', '.raw.txt');
      writeFileSync(errFile, raw);
      if (attempt < MAX_VALIDATION_RETRIES) {
        console.warn(`  JSON parse failed — retrying (${e})`);
        lastErrors = ['Response was not valid JSON. Return ONLY a JSON object, no markdown or explanation.'];
        continue;
      }
      console.error(`\n  Failed to parse JSON after ${attempt + 1} attempts. Raw output saved to: ${errFile}`);
      console.error(`  Error: ${e}`);
      process.exit(1);
    }

    // Validate
    const errors = validate(parsed, sections.length);
    if (errors.length > 0 && attempt < MAX_VALIDATION_RETRIES) {
      console.warn(`  Validation issues (${errors.length}) — retrying:`);
      errors.forEach(e => console.warn(`    - ${e}`));
      lastErrors = errors;
      continue;
    }
    if (errors.length > 0) {
      console.warn(`  Validation warnings (proceeding anyway):`);
      errors.forEach(e => console.warn(`    - ${e}`));
    }

    // Populate prose from section references
    for (const scene of parsed.scenes ?? []) {
      const sectionNums: number[] = scene.sections ?? [];
      scene.prose = sectionNums
        .filter((n: number) => n >= 1 && n <= sections.length)
        .sort((a: number, b: number) => a - b)
        .map((n: number) => sections[n - 1])
        .join('\n\n');
      delete scene.sections;
    }

    writeFileSync(outputFile, JSON.stringify(parsed, null, 2));
    console.log(`\n  Output: ${outputFile}`);
    console.log(`  Characters: ${parsed.characters?.length ?? 0}`);
    console.log(`  Locations: ${parsed.locations?.length ?? 0}`);
    console.log(`  Threads: ${parsed.threads?.length ?? 0}`);
    console.log(`  Scenes: ${parsed.scenes?.length ?? 0}`);
    console.log(`  Relationships: ${parsed.relationships?.length ?? 0}`);
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
