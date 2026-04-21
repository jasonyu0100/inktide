/**
 * Shared research categories for surveys + interviews. Same eight names
 * across both surfaces — surveys apply the lens to the whole world (cast-
 * wide signal on that dimension), interviews apply it deeply to one
 * subject (full profile on that dimension).
 *
 * The AI generators accept an optional category and tilt their prompt
 * accordingly. "" / undefined means "let the engine pick the angle".
 */

export type ResearchCategory =
  | "General"
  | "Personality"
  | "Values"
  | "Knowledge"
  | "Trust"
  | "Allegiance"
  | "Threat"
  | "Predictions"
  | "Backstory";

export const RESEARCH_CATEGORIES: ResearchCategory[] = [
  "General",
  "Personality",
  "Values",
  "Knowledge",
  "Trust",
  "Allegiance",
  "Threat",
  "Predictions",
  "Backstory",
];

/**
 * Per-category prompt fragments — used by both survey + interview AI
 * generators. Each fragment names BOTH framings:
 *   – global (survey)      → cast-wide signal on this dimension
 *   – individual (interview) → one mind's profile on this dimension
 * The model picks question shapes that fit the axis it's running on.
 */
export const CATEGORY_GUIDANCE: Record<ResearchCategory, string> = {
  General:
    "The most illuminating probe available — no predetermined angle. Pick whatever would teach the author the most about this specific subject / world right now, drawing on ALL the continuity recorded. Favour questions that surface foundational context (who they are / what this world actually is / what matters most here) and asymmetries between what's on the page and what the entities silently carry. Vary question types to match the angle.",
  Personality:
    "Enduring traits — extraversion, conscientiousness, openness, agreeableness, stability. Surveys: rate each respondent on a shared trait (likert). Interviews: probe self-rating vs behaviour under pressure across multiple traits. Surface gaps between how the subject sees themselves and how they actually act.",
  Values:
    "What is and isn't tradeable. Surveys: cast-wide forced choice on a values pair (loyalty vs honesty, mercy vs justice, ambition vs comfort) — the split reveals the world's value fault-lines. Interviews: walk one subject through several value pairs to map their hierarchy. Reasoning is the goldmine.",
  Knowledge:
    "What each subject knows — and where the gaps are. Surveys: ask everyone for an estimate (a date, a distance, a count) so divergence reveals who has the information. Interviews: probe one subject's awareness across multiple facts (have you met X, do you know about Y) to map their knowledge surface.",
  Trust:
    "Who trusts whom and how much. Surveys: ask the cast to rate trust in a single named other (likert) — the row reveals that person's social standing. Interviews: walk one subject through trust ratings of several others to draw their personal trust map. Reasoning often surfaces the formative incident.",
  Allegiance:
    "Where each subject stands on factions, sides, and policy. Surveys: cast-wide stance on a policy or faction question (binary or choice) — splits reveal the world's coalitions. Interviews: probe one subject across several allegiance questions to map their loyalties and lines they wouldn't cross.",
  Threat:
    "Perceived danger. Surveys: rank a named threat across the cast (likert) — reveals who fears what. Interviews: present several threats to one subject for ranking and reasoning — reveals their priorities, blind spots, and the world's actual power structure as seen from inside.",
  Predictions:
    "What is expected to happen next. Surveys: ask the cast the same forecast (binary, likert confidence, or estimate) — disagreement reveals divergent information sets. Interviews: probe one subject across several forecasts (political, personal, environmental) to map their model of where things are going.",
  Backstory:
    "Formative experiences and identity origins. Surveys: ask the cast a single open-ended origin question (e.g. \"name the moment that shaped you most\") — the spread of answers reveals the world's range of formative shapes. Interviews: walk one subject through their backstory with mostly open questions — the subject's own words are the data.",
};
