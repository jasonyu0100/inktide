/**
 * Survey executor — query characters, locations, and artifacts in parallel
 * using their world-graph continuity (the same private-self-knowledge
 * mechanism the Character chat persona uses). Each respondent answers in
 * voice; the aggregate becomes a research signal for the author.
 *
 * Pure helpers here (resolve, build prompts, parse). The orchestrator
 * dispatches LLM calls and stores responses back via the supplied callback.
 */

import { callGenerate } from "@/lib/ai/api";
import { narrativeContext } from "@/lib/ai/context";
import { FatalApiError } from "@/lib/ai/errors";
import { parseJson } from "@/lib/ai/json";
import { ANALYSIS_MODEL, ANALYSIS_TEMPERATURE } from "@/lib/constants";
import type {
  Artifact,
  Character,
  Location,
  NarrativeState,
  Survey,
  SurveyConfig,
  SurveyQuestionType,
  SurveyResponse,
  SurveyRespondentFilter,
  SurveyRespondentKind,
} from "@/types/narrative";

// ── Respondent resolution ─────────────────────────────────────────────────

export type Respondent =
  | { kind: "character"; id: string; entity: Character }
  | { kind: "location"; id: string; entity: Location }
  | { kind: "artifact"; id: string; entity: Artifact };

export function respondentName(r: Respondent): string {
  return r.entity.name;
}

/**
 * Apply the survey's filter to the narrative and return every entity that
 * qualifies. Order: anchors / domain locations / key artifacts first so
 * progress UI shows the most important respondents resolving first.
 */
export function resolveRespondents(
  narrative: NarrativeState,
  filter: SurveyRespondentFilter,
): Respondent[] {
  const out: Respondent[] = [];

  if (filter.kinds.includes("character")) {
    const allowedRoles = new Set(filter.characterRoles ?? ["anchor", "recurring", "transient"]);
    for (const c of Object.values(narrative.characters)) {
      if (allowedRoles.has(c.role)) out.push({ kind: "character", id: c.id, entity: c });
    }
  }

  if (filter.kinds.includes("location")) {
    const allowed = new Set(filter.locationProminence ?? ["domain", "place", "margin"]);
    for (const l of Object.values(narrative.locations)) {
      if (allowed.has(l.prominence)) out.push({ kind: "location", id: l.id, entity: l });
    }
  }

  if (filter.kinds.includes("artifact")) {
    const allowed = new Set(filter.artifactSignificance ?? ["key", "notable", "minor"]);
    for (const a of Object.values(narrative.artifacts ?? {})) {
      if (allowed.has(a.significance)) out.push({ kind: "artifact", id: a.id, entity: a });
    }
  }

  // Stable ordering — anchor/domain/key first, then by name within each tier.
  const tier = (r: Respondent): number => {
    if (r.kind === "character") return r.entity.role === "anchor" ? 0 : r.entity.role === "recurring" ? 1 : 2;
    if (r.kind === "location") return r.entity.prominence === "domain" ? 0 : r.entity.prominence === "place" ? 1 : 2;
    return r.entity.significance === "key" ? 0 : r.entity.significance === "notable" ? 1 : 2;
  };
  return out.sort((a, b) => tier(a) - tier(b) || a.entity.name.localeCompare(b.entity.name));
}

// ── Persona prompt builders ────────────────────────────────────────────────
// Each kind speaks from its own continuity. The same private-self-knowledge
// principle applies: the world graph is raw awareness, not a script to
// recite. The persona answers the question through that filter.

function continuityBlock(world: { nodes: Record<string, { type?: string; content: string }> } | undefined): string {
  if (!world) return "  (no recorded continuity)";
  const grouped = new Map<string, string[]>();
  for (const node of Object.values(world.nodes)) {
    const type = node.type ?? "other";
    const bucket = grouped.get(type) ?? [];
    bucket.push(node.content);
    grouped.set(type, bucket);
  }
  if (grouped.size === 0) return "  (no recorded continuity)";
  return Array.from(grouped.entries())
    .map(([type, contents]) => `  ${type.toUpperCase()}:\n${contents.map((c) => `    - ${c}`).join("\n")}`)
    .join("\n");
}

function characterPersona(narrative: NarrativeState, c: Character): string {
  return `You ARE ${c.name}. Respond in first person.

YOUR PRIVATE INNER CONTINUITY — raw self-knowledge, not a script to recite:
${continuityBlock(c.world)}

THE WORLD YOU LIVE IN:
${narrative.worldSummary || "(no recorded setting)"}

Speak in your own voice. Let traits become tone, history become understanding, beliefs surface only when the topic touches them.`;
}

function locationPersona(narrative: NarrativeState, l: Location): string {
  return `You ARE the place known as ${l.name}. Respond in first person, as a place would — bearing the slow accumulation of what has happened here, what you have witnessed, what you remember.

YOUR ACCUMULATED CONTINUITY — the raw awareness of this place:
${continuityBlock(l.world)}

THE WORLD YOU SIT WITHIN:
${narrative.worldSummary || "(no recorded setting)"}

Speak with the patience and weight of geography. Distances are felt; eras pass through you. You answer from the perspective only a place can offer.`;
}

function artifactPersona(narrative: NarrativeState, a: Artifact): string {
  return `You ARE the object known as ${a.name}. Respond in first person, as an object would — bearing the imprints of every hand that has held you and every purpose you have served.

YOUR ACCUMULATED CONTINUITY — provenance, properties, and the imprints you carry:
${continuityBlock(a.world)}

THE WORLD YOU EXIST WITHIN:
${narrative.worldSummary || "(no recorded setting)"}

Speak with the focused awareness of an instrument — your function, your history, the meaning you carry for those who hold you.`;
}

export function buildRespondentPersona(narrative: NarrativeState, r: Respondent): string {
  if (r.kind === "character") return characterPersona(narrative, r.entity);
  if (r.kind === "location") return locationPersona(narrative, r.entity);
  return artifactPersona(narrative, r.entity);
}

// ── User-prompt builder ────────────────────────────────────────────────────
// Every question type produces a JSON-shaped response so parsing is uniform.
// The persona prompt above carries the in-character framing; this prompt
// just states the question and the response schema.

export function buildSurveyUserPrompt(survey: Survey): string {
  const { question, questionType, config } = survey;

  switch (questionType) {
    case "binary":
      return `Question: ${question}

Answer in JSON only:
{
  "answer": true | false,
  "reasoning": "ONE short sentence in your own voice explaining why."
}`;
    case "likert": {
      const scale = config?.scale ?? 5;
      const anchors = scale === 3
        ? "1 = disagree, 2 = neutral, 3 = agree"
        : scale === 7
        ? "1 = strongly disagree, 4 = neutral, 7 = strongly agree"
        : "1 = strongly disagree, 3 = neutral, 5 = strongly agree";
      return `Question: ${question}

Answer on a ${scale}-point scale (${anchors}). Respond in JSON only:
{
  "answer": <integer 1..${scale}>,
  "reasoning": "ONE short sentence in your own voice explaining why."
}`;
    }
    case "estimate": {
      const unit = config?.unit ? ` (in ${config.unit})` : "";
      return `Question: ${question}${unit}

Give your best honest guess as a NUMBER. Respond in JSON only:
{
  "answer": <number>,
  "reasoning": "ONE short sentence in your own voice explaining how you arrived at it."
}`;
    }
    case "choice": {
      const options = (config?.options ?? []).map((o) => `"${o}"`).join(" | ");
      return `Question: ${question}

Pick exactly one of: ${options}

Respond in JSON only:
{
  "answer": <one of the options above, exact string match>,
  "reasoning": "ONE short sentence in your own voice explaining why."
}`;
    }
    case "open":
      return `Question: ${question}

Respond in JSON only:
{
  "answer": "Your answer in your own voice — keep it under 3 sentences.",
  "reasoning": "Optional ONE-sentence note on what shaped that answer; may be blank."
}`;
  }
}

// ── Response parser ────────────────────────────────────────────────────────

type RawAnswer = { answer: unknown; reasoning?: unknown };

export function parseSurveyResponse(
  raw: string,
  survey: Survey,
  respondent: Respondent,
): SurveyResponse {
  const parsed = parseJson(raw, `survey:${survey.id}:${respondent.id}`) as RawAnswer;
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  const base = {
    respondentId: respondent.id,
    respondentKind: respondent.kind,
    reasoning,
    timestamp: Date.now(),
  };

  switch (survey.questionType) {
    case "binary": {
      const v = parsed.answer;
      const value = typeof v === "boolean" ? v : typeof v === "string" ? /^(yes|true|1)$/i.test(v.trim()) : false;
      return { ...base, answer: { type: "binary", value } };
    }
    case "likert": {
      const scale = survey.config?.scale ?? 5;
      const v = typeof parsed.answer === "number" ? parsed.answer : Number(parsed.answer);
      const value = clampInt(v, 1, scale);
      return { ...base, answer: { type: "likert", value } };
    }
    case "estimate": {
      const v = typeof parsed.answer === "number" ? parsed.answer : Number(parsed.answer);
      return { ...base, answer: { type: "estimate", value: Number.isFinite(v) ? v : 0 } };
    }
    case "choice": {
      const options = survey.config?.options ?? [];
      const v = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
      const matched = options.find((o) => o.toLowerCase() === v.toLowerCase()) ?? options[0] ?? v;
      return { ...base, answer: { type: "choice", value: matched } };
    }
    case "open":
      return {
        ...base,
        answer: { type: "open", value: typeof parsed.answer === "string" ? parsed.answer.trim() : "" },
      };
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

// ── Orchestrator ───────────────────────────────────────────────────────────

const SURVEY_CONCURRENCY = 5;

export type SurveyRunCallbacks = {
  /** Called when each respondent's answer (success or error) lands. */
  onResponse: (response: SurveyResponse) => void;
  /** Progress ticks: completed / total. */
  onProgress?: (completed: number, total: number) => void;
};

/**
 * Run the survey across every resolved respondent in parallel, capped at
 * `SURVEY_CONCURRENCY` in flight. Per-respondent failures are captured as
 * SurveyResponse with an `error` field so the UI can show coverage gaps.
 *
 * Throws `FatalApiError` to the caller if it surfaces (credit exhaustion,
 * auth, forbidden) — every loop in the codebase halts on this signal.
 */
export async function runSurvey(
  narrative: NarrativeState,
  survey: Survey,
  cb: SurveyRunCallbacks,
  cancelled: () => boolean,
): Promise<void> {
  const respondents = resolveRespondents(narrative, survey.respondentFilter);
  const total = respondents.length;
  let completed = 0;
  cb.onProgress?.(completed, total);

  let cursor = 0;
  let fatal: FatalApiError | null = null;

  async function worker() {
    while (cursor < respondents.length && !cancelled() && !fatal) {
      const r = respondents[cursor++];
      try {
        const systemPrompt = buildRespondentPersona(narrative, r);
        const userPrompt = buildSurveyUserPrompt(survey);
        const raw = await callGenerate(
          userPrompt,
          systemPrompt,
          undefined,
          `survey:${survey.questionType}`,
          ANALYSIS_MODEL,
          undefined,
          true, // jsonMode — every response is structured JSON
          ANALYSIS_TEMPERATURE, // near-deterministic — research signal must be reproducible
        );
        if (cancelled()) return;
        const response = parseSurveyResponse(raw, survey, r);
        cb.onResponse(response);
      } catch (err) {
        if (err instanceof FatalApiError) {
          fatal = err;
          return;
        }
        // Soft failure — record so the UI can show a coverage gap for this
        // respondent without losing the others.
        cb.onResponse({
          respondentId: r.id,
          respondentKind: r.kind,
          answer: defaultAnswerFor(survey),
          reasoning: "",
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        completed += 1;
        cb.onProgress?.(completed, total);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(SURVEY_CONCURRENCY, total) }, () => worker()));
  if (fatal) throw fatal;
}

function defaultAnswerFor(survey: Survey): SurveyResponse["answer"] {
  switch (survey.questionType) {
    case "binary": return { type: "binary", value: false };
    case "likert": return { type: "likert", value: Math.ceil((survey.config?.scale ?? 5) / 2) };
    case "estimate": return { type: "estimate", value: 0 };
    case "choice": return { type: "choice", value: survey.config?.options?.[0] ?? "" };
    case "open": return { type: "open", value: "" };
  }
}

// ── AI question generation ────────────────────────────────────────────────
// Given full narrative continuity, propose meaningful survey questions the
// author could pose. Each proposal includes question text, type, optional
// config (scale, unit, options) and a one-line `intent` so the user can
// understand WHY this question would be revealing.

export type SurveyProposal = {
  question: string;
  questionType: SurveyQuestionType;
  config?: SurveyConfig;
  /** What the author would learn from this — surfaces under the question. */
  intent: string;
  /**
   * Who this question should be asked of — the engine picks a scope that
   * fits the question (e.g. "do the anchors trust X?" → anchors only;
   * "estimate the distance to Y" → every character who might know).
   * The UI surfaces this as the initial scope selection; the author can
   * edit it before sending.
   */
  suggestedFilter?: SurveyRespondentFilter;
};

const SURVEY_GEN_SYSTEM = `You are a research assistant helping a long-form fiction author probe their world through ONE sharp survey question at a time. You will read the full narrative continuity and propose a SINGLE question the author should pose to every character / location / artifact in the world.

A strong question:
- Probes something not already explicit — knowledge asymmetries, divergent beliefs, hidden tensions, predictions, perceptions of trust / power / threat / loyalty.
- Is answerable IN CHARACTER. The respondent will answer privately from their world graph. No meta-narrative, no fourth-wall breaks.
- Generates SIGNAL. Questions every respondent would answer the same way are useless; questions that split the cast are gold.
- Picks the right TYPE for the shape of insight you want:
    binary    — clean split
    likert    — graduated stance (use 5-point unless the question genuinely needs 3 or 7)
    estimate  — numeric guess; reveals knowledge asymmetries
    choice    — forced rank among named alternatives
    open      — only when the value is the individual voice, not the aggregate

ASYMMETRY IS YOUR WEAPON. "Estimate the protagonist's age" reveals who has met them. "Do you trust the merchant?" reveals who has been burned. "Rank these three threats" reveals priorities.

ALSO CHOOSE A SCOPE — who the question should be asked of. A well-scoped question reveals more than a carelessly-broad one: "do you trust the high priest?" makes sense across all characters; "how many li is it to the capital?" makes sense only to characters who might know; "have we been visited by a dragon here?" makes sense across locations, not characters.

Pick the narrowest scope that still generates useful variance. Do NOT ask locations or artifacts when the question only makes sense to people. Do NOT ask transient characters about matters only anchors would know.

OUTPUT FORMAT — JSON only, no preamble, EXACTLY ONE proposal:
{
  "question": "<question, addressed to the respondent in second person>",
  "questionType": "binary" | "likert" | "estimate" | "choice" | "open",
  "config": { "scale": 3|5|7 } | { "unit": "<short word>" } | { "options": ["A","B","C"] } | null,
  "intent": "<one short sentence: what the author would learn>",
  "suggestedFilter": {
    "kinds": ["character"] | ["location"] | ["artifact"] | any combination,
    "characterRoles": ["anchor", "recurring", "transient"],    // omit to include all
    "locationProminence": ["domain", "place", "margin"],       // omit to include all
    "artifactSignificance": ["key", "notable", "minor"]        // omit to include all
  }
}`;

/** Generate ONE proposal tailored to the narrative — auto-populates the composer.
 *  An optional `category` tilts the question toward a specific lens
 *  (Personality, Values, Trust, etc. — see RESEARCH_CATEGORIES). */
export async function generateSurveyProposal(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  category?: string,
): Promise<SurveyProposal | null> {
  const ctx = narrativeContext(narrative, resolvedKeys, currentIndex);
  const trimmed = category?.trim();
  const lens = !trimmed
    ? ""
    : trimmed === "General"
    ? `\n\nLENS: General — pick the single most illuminating question for THIS world, no predetermined angle. Favour foundational probes (who the cast is, what this world actually is, what matters most here) and asymmetries between what's on the page and what the entities silently carry.`
    : `\n\nLENS: probe the world through the lens of "${trimmed}". The single question you propose should illuminate this dimension across the cast.`;
  const userPrompt = `Narrative continuity:

${ctx}${lens}

Propose ONE survey question tailored to THIS world and cast. Pick the question that would teach the author the MOST about their world — favour asymmetry-rich probes that split the cast.`;

  const raw = await callGenerate(
    userPrompt,
    SURVEY_GEN_SYSTEM,
    undefined,
    "generateSurveyProposal",
    ANALYSIS_MODEL,
    undefined,
    true,
    ANALYSIS_TEMPERATURE,
  );
  const parsed = parseJson(raw, "generateSurveyProposal") as Record<string, unknown>;
  return coerceProposal(parsed);
}

const VALID_TYPES: SurveyQuestionType[] = ["binary", "likert", "estimate", "choice", "open"];

/**
 * Toggle one tier in a survey's respondent filter. The UI treats an
 * undefined tier list as "all tiers included" — clicking a lit chip
 * must therefore REMOVE that tier from the implicit full set, not
 * create a single-element list (a silent narrowing bug). When the
 * resulting list covers every tier, it collapses back to undefined.
 *
 * Pure helper exposed here so the reducer-like semantics can be pinned
 * by tests independent of the composer component.
 */
export function toggleRespondentTier(
  filter: SurveyRespondentFilter,
  key: "characterRoles" | "locationProminence" | "artifactSignificance",
  tier: string,
  allTiers: readonly string[],
): SurveyRespondentFilter {
  const raw = filter[key] as string[] | undefined;
  const current = raw ?? [...allTiers];
  const next = current.includes(tier)
    ? current.filter((t) => t !== tier)
    : [...current, tier];
  const isAll = allTiers.every((t) => next.includes(t));
  return { ...filter, [key]: isAll ? undefined : next };
}

/** Exported for tests — shape-checks the LLM's proposal JSON and fills in defaults. */
export function coerceProposal(p: Record<string, unknown>): SurveyProposal | null {
  const question = typeof p.question === "string" ? p.question.trim() : "";
  if (!question) return null;
  const questionType = VALID_TYPES.includes(p.questionType as SurveyQuestionType)
    ? (p.questionType as SurveyQuestionType)
    : "binary";
  const intent = typeof p.intent === "string" ? p.intent.trim() : "";
  const config = coerceConfig(questionType, p.config);
  const suggestedFilter = coerceFilter(p.suggestedFilter);
  return {
    question,
    questionType,
    intent,
    ...(config ? { config } : {}),
    ...(suggestedFilter ? { suggestedFilter } : {}),
  };
}

const VALID_KINDS: SurveyRespondentKind[] = ["character", "location", "artifact"];
const VALID_ROLES = ["anchor", "recurring", "transient"] as const;
const VALID_PROMINENCE = ["domain", "place", "margin"] as const;
const VALID_SIGNIFICANCE = ["key", "notable", "minor"] as const;

function coerceFilter(raw: unknown): SurveyRespondentFilter | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const kinds = Array.isArray(r.kinds)
    ? (r.kinds as unknown[]).filter((k): k is SurveyRespondentKind =>
        typeof k === "string" && (VALID_KINDS as string[]).includes(k),
      )
    : [];
  if (kinds.length === 0) return undefined;
  const filter: SurveyRespondentFilter = { kinds };
  const sub = <T extends string>(arr: unknown, valid: readonly T[]): T[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    const out = (arr as unknown[]).filter((v): v is T => typeof v === "string" && (valid as readonly string[]).includes(v));
    return out.length > 0 ? out : undefined;
  };
  const roles = sub(r.characterRoles, VALID_ROLES);
  const prominence = sub(r.locationProminence, VALID_PROMINENCE);
  const significance = sub(r.artifactSignificance, VALID_SIGNIFICANCE);
  if (roles) filter.characterRoles = roles;
  if (prominence) filter.locationProminence = prominence;
  if (significance) filter.artifactSignificance = significance;
  return filter;
}

function coerceConfig(type: SurveyQuestionType, raw: unknown): SurveyConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (type === "likert") {
    const s = Number(r.scale);
    return { scale: (s === 3 || s === 7 ? s : 5) as 3 | 5 | 7 };
  }
  if (type === "estimate") {
    return typeof r.unit === "string" ? { unit: r.unit.trim() } : undefined;
  }
  if (type === "choice") {
    const opts = Array.isArray(r.options)
      ? (r.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim())
      : [];
    return opts.length >= 2 ? { options: opts } : undefined;
  }
  return undefined;
}
