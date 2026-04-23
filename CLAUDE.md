# InkTide

Knowledge-graph-based text analysis, querying, and generation platform. Primary flow: **analyze → query → generate**. Runs multiple layers of structural analysis over any long-form text — fiction, academic papers, non-fiction. Builds toward a connected network of text corpuses where each analyzed work enriches the system. Next.js 16 + React 19 + TypeScript.

## Core Concept

Narrative is a composition of three forces in flux: **fate** (the accumulated commitment of threads pulling the story toward resolution), **world** (the inner transformation of entities), and **system** (the deepening of rules and structures). Different works weight these forces differently — a Classic is fate-dominant, a Show is world-dominant, a Paper is system-dominant, and an Opus balances all three. Fate is the unifying force: it pulls world and system toward narrative resolution. A story without fate has no resolution; a story without world has no people; a story without system has no physics.

Text is modelled as a **knowledge graph** that mutates section by section. An LLM records structural deltas (threads, world, system) at each section, and the three forces are derived deterministically from these deltas. Each analyzed work contributes to a growing network — pacing patterns become reusable, prose profiles capture authorial rhythm, and propositions are embedded for cross-corpus search. This enables:

### Analysis
- **Force analysis** — Fate, World, System derived from graph deltas via deterministic z-score normalised formulas
- **Embedding analysis** — vector embeddings over every beat and proposition for meaning-based search and propositional logic
- **Pacing analysis** — Markov transition matrices on scene-level cube modes and beat-level prose rhythm, derived from published works
- **Scale & density** — story scale metrics and world knowledge interconnection depth
- **Swing** — dynamic contrast between consecutive sections (breathing vs flatline)

### Querying
- **Semantic search** — meaning-based retrieval with AI-synthesized overviews and inline citations
- **Propositional analysis** — logical analysis of embedded propositions to surface hidden connections

### Interrogation (deep world understanding)
- **Surveys** — one question × N respondents; each entity answers in-character from its own world-graph continuity. Eight research lenses (Personality, Values, Knowledge, Trust, Allegiance, Threat, Predictions, Backstory) + General
- **Interviews** — one subject × N questions; AI-generated question batches tuned to the subject's recorded continuity
- **Game theory** — per-scene decomposition into 2×2 games (14 axes × 19 shapes), additive to scene.gameAnalysis without mutating deltas
- **ELO rankings** — continuous margin score from stake deltas drives per-player rating updates across all games; trajectories, W/L/D, outcome mix, Nash-rate and behavioural tags (extractor, schemer, dominant, responder, steady, rival:X)

### Generation
- **Causal reasoning graphs** — 8–20 typed nodes per arc (fate, reasoning, character, location, artifact, system, pattern, warning, chaos) with typed edges; scenes execute the graph
- **Four thinking modes** — abduction (default, backward selective), divergent (forward expansive), deduction (forward narrow), induction (backward generalising)
- **Markov chain pacing** — transition matrices from analyzed works shape scene-by-scene rhythm
- **MCTS search** — explores branching narrative paths, each expansion guided by a fresh pacing sequence
- **Planning with course correction** — direction vectors rewritten after each arc
- **Iterative revision** — evaluate → verdict (ok/edit/merge/insert/cut) → reconstruct versioned branches
- **Prose profiles** — beat plans with authorial Markov chains over a 10-function / 8-mechanism taxonomy
- **Pacing presets** — curated sequences that bypass Markov sampling for targeted arcs

## Quick Reference

```bash
npm run dev      # Start dev server (localhost:3001)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

- **Frontend:** Next.js App Router, React 19, Tailwind CSS v4, D3.js
- **AI:** OpenRouter API (streaming) — raw HTTP, no SDK. Models: Gemini 2.5 Flash (default/analysis/generation), Gemini 3 Flash Preview (writing)
- **Embeddings:** OpenAI API (text-embedding-3-small, 1536 dimensions) — semantic search over scenes, beats, propositions
- **Images:** Replicate API (Seedream 4.5) via `/api/generate-image`, `/api/generate-cover`
- **State:** React Context + useReducer in `src/lib/store.tsx`
- **Persistence:** IndexedDB (narratives, embeddings) + localStorage (meta) via `src/lib/persistence.ts`, `src/lib/idb.ts`
- **Types:** Domain model in `src/types/narrative.ts`, MCTS types in `src/types/mcts.ts`, config in `src/lib/constants.ts`

## Key Directories

```
src/
├── app/                    # Next.js routes & API endpoints
│   ├── series/[id]/        # Main story editor workspace
│   ├── paper/              # Whitepaper — theory, formulas, validation
│   ├── analysis/           # Text-to-narrative extraction pipeline
│   └── api/                # generate, chat, generate-image, generate-cover, random-idea, suggest-premise, analyze-chapter
├── components/             # React UI (organized by feature area)
│   ├── story/              # StoryReader — prose reading/grading/rewriting
│   ├── canvas/             # WorldGraph — interactive entity/knowledge graph
│   ├── inspector/          # SidePanel — entity detail views (vertical tab rail)
│   ├── timeline/           # TimelineStrip, ForceCharts, NarrativeCubeViewer, BranchEval
│   ├── topbar/             # TopBar, CubeExplorer, FormulaModal, ApiKeyModal
│   ├── generation/         # GeneratePanel, BranchModal, PacingStrip, MarkovGraph
│   ├── analytics/          # ForceTracker — stock-type force analysis
│   ├── auto/               # AutoControlBar, AutoSettingsPanel
│   ├── mcts/               # MCTSPanel, MCTSControlBar
│   ├── slides/             # SlidesPlayer + individual slide components
│   ├── sidebar/            # SeriesPicker, ThreadPortfolio, MediaDrive
│   ├── layout/             # AppShell, RulesPanel
│   ├── wizard/             # CreationWizard — new story flow
│   └── chat/               # ChatPanel
├── lib/                    # Core logic
│   ├── ai/                 # LLM calls (modularised)
│   │   ├── api.ts          # callGenerate, callGenerateStream
│   │   ├── context.ts      # branchContext, sceneContext — LLM context building
│   │   ├── scenes.ts       # generateScenes, generateScenePlan
│   │   ├── prose.ts        # rewriteSceneProse
│   │   ├── world.ts        # expandWorld, suggestDirection, generateNarrative
│   │   ├── review.ts       # reviewBranch, reviewProseQuality, reviewPlanQuality — branch evaluation with guided feedback
│   │   ├── reconstruct.ts  # reconstructBranch — versioned branch reconstruction from verdicts
│   │   ├── prompts.ts      # Modular prompt sections (force standards, pacing, deltas, POV, world)
│   │   └── json.ts         # JSON parsing utilities
│   ├── beat-profiles.ts    # Beat Markov matrices, profile presets, sampleBeatSequence
│   ├── narrative-utils.ts  # Force calculation formulas, cube logic, graph algorithms
│   ├── pacing-profile.ts           # Markov chain pacing — transition matrices, sequence sampling, presets, prompt generation
│   ├── store.tsx           # State management + reducer actions
│   ├── text-analysis.ts    # Corpus → NarrativeState extraction (scene-first: plans → structure → arcs)
│   ├── auto-engine.ts      # Automated story generation — phase-aware force management
│   ├── mcts-engine.ts      # MCTS scene exploration
│   ├── mcts-state.ts       # MCTS state management
│   ├── slides-data.ts      # Slide generation logic
│   ├── constants.ts        # All tunable config values
│   ├── persistence.ts      # IndexedDB + localStorage read/write
│   ├── idb.ts              # IndexedDB wrapper with stores for narratives, embeddings, API logs
│   ├── search.ts           # Semantic search via cosine similarity over embeddings
│   ├── embeddings.ts       # Embedding generation, storage, retrieval via OpenAI API
│   ├── epub-export.ts      # EPUB export
│   └── api-logger.ts       # API call logging & token tracking
├── types/
│   ├── narrative.ts        # Domain types: Scene, Character, Location, Thread, Arc, StructureEvaluation, etc.
│   └── mcts.ts             # MCTS-specific types
├── hooks/                  # useAutoPlay, useMCTS, useFeatureAccess
└── data/                   # Seed narratives (HP, LOTR, Star Wars, GoT, Reverend Insanity)
```

## Domain Model (src/types/narrative.ts)

- **NarrativeState** — top-level: characters, locations, artifacts, threads, arcs, scenes, worldBuilds, branches, structureEvaluations
- **Character** — `role: anchor|recurring|transient`, world graph (inner world), threadIds
- **Location** — `prominence: domain|place|margin`, world graph (accumulated history), threadIds
- **Artifact** — `significance: key|notable|minor`, world graph (provenance, properties), threadIds
- **Scene** — povId, locationId, participantIds, events, threadDeltas, worldDeltas, relationshipDeltas, characterMovements, plan, prose, proseScore
- **Thread** — participants can be `character|location|artifact`; lifecycle status; deltas record fate/world per scene
- **Branch** — git-like branching for story timelines; entryIds interleave scenes + world commits
- **StructureEvaluation** — per-scene verdicts (ok/edit/merge/insert/cut), overall critique, repetition patterns, thematic question
- **Arc** — world-building arcs that group scenes and expand the narrative world
- **CubeCorner** — one of 8 narrative modes defined by high/low combinations of the three forces

## Research Methods (src/lib/ai/surveys.ts, interviews.ts, research-categories.ts)

Three instruments turn the knowledge graph into an interrogable system. Every respondent answers in-character, grounded in its own world-graph continuity — the same private-self-knowledge the Character chat persona uses.

### Surveys — cast-wide distribution
- **Shape**: one question × N respondents (characters, locations, artifacts). Filter by role / prominence / significance
- **Question types**: binary, likert (5-pt default), estimate (numeric), choice (forced rank), open
- **Research categories** (eight lenses + General): Personality, Values, Knowledge, Trust, Allegiance, Threat, Predictions, Backstory — each tilts the AI's question shape
- **Output**: a distribution that reveals fault-lines (trust matrix rows, value hierarchies, knowledge asymmetries)
- **Execution**: parallel LLM calls with per-respondent persona prompt built from continuity; responses aggregated and scored

### Interviews — single-subject depth
- **Shape**: one subject × 5–7 AI-generated questions
- **Same question types + categories as surveys**, applied to one mind
- **Output**: a coherent profile — how this specific subject carries the world
- **Composition**: survey to find outliers, interview to probe them

### Files
- `src/lib/ai/surveys.ts` — executor, respondent resolution, prompt builders, parsers
- `src/lib/ai/interviews.ts` — one-subject-many-questions executor (reuses survey parsers)
- `src/lib/research-categories.ts` — the eight category guidance strings shared by both
- `src/components/sidebar/{SurveyPanel,InterviewPanel}.tsx` — UI

## Game Theory & ELO (src/lib/ai/game-analysis.ts, game-theory.ts)

Per-scene strategic decomposition. Purely additive — writes only to `scene.gameAnalysis`, never mutates deltas, threadLogs, or forces.

### Game decomposition
- **Input**: scene prose (authoritative) OR beat plan (fallback) OR structural deltas (last resort)
- **Output**: a sequence of 2×2 games, one per strategic beat. Each carries:
  - `axis` — one of 14 dichotomies (disclosure, identity, trust, alliance, confrontation, status, pressure, stakes, control, acquisition, obligation, moral, commitment, timing)
  - `gameType` — one of 19 shapes (coordination, anti-coordination, battle-of-sexes, dilemma, stag-hunt, chicken, zero-sum, pure-opposition, contest, collective-action, principal-agent, screening, signaling, stealth, stackelberg, cheap-talk, commitment-game, bargaining, trivial)
  - `outcomes` — integer stake deltas (-4..+4) for each player in each cell
  - `realizedAAction` / `realizedBAction` — what the author actually wrote

### ELO rating
- `ELO_INITIAL = 1500`, `ELO_K = 32`
- **Margin score**: `clamp(0.5 + (ΔA − ΔB) / 16, 0, 1)` — continuous, folds margin-of-victory into the expected-vs-actual math (a +4/−4 crush = 1.0; a +1/0 edge = ~0.56; tie = 0.5)
- `gameScoreA` (separate) = binary W/L/D for display; **not** what ELO consumes
- `computeEloHistories` walks games in narrative order and returns per-player rating trajectories
- **Behavioural tags** derived from trajectory + outcome mix: *extractor* (mostly zero-sum wins), *dominant* (high ELO + Nash rate), *schemer* (asymmetric-info game wins), *responder* (mostly reactive), *steady* (low variance), *rival: X* (recurrent opponent)

### Files
- `src/lib/game-theory.ts` — pure math (Nash, stake rank, ELO updates, trajectory history)
- `src/lib/ai/game-analysis.ts` — LLM decomposition of scenes into games
- `src/components/topbar/GameTheoryDashboard.tsx` — player rankings, trajectories, outcome mix
- `src/components/canvas/SceneGameTheoryView.tsx` — per-scene payoff matrix with NASH / REALIZED highlights

## Reasoning Graphs & Thinking Modes (src/lib/ai/reasoning-graph.ts, reasoning-graph/)

The causal reasoning graph is how InkTide plans an arc. Built once per arc before any scene is generated; scenes execute the graph.

### Graph structure (8–20 nodes/arc)
- **Node types**: fate, reasoning, character, location, artifact, system, pattern, warning, chaos
- **Edge types**: requires, enables, constrains, risks, causes, reveals, develops, resolves
- **Tiers**: pressure (fate, warning) forces change, substrate (char/loc/art/sys) is what changes, bridge (reasoning, pattern) connects them

### Four thinking modes
- **abduction** (default) — backward + selective. Committed outcome ← best hypothesis among competitors. Anchor discipline prevents silent drift into deduction
- **divergent** — forward + expansive. One source branches into many possibilities; leaves marked for pairwise-compatibility
- **deduction** — forward + narrow. Premise → necessary consequence chain. High branching factor is a red flag (signals drift to divergent)
- **induction** — backward + generalising. Many observations → inferred principle. Retains competing generalisations

### Cross-arc divergence
Each arc's generation sees the **previous arc's reasoning graph** fed in via `findLastArcGraph` + `buildSequentialPath`, with explicit divergence pressure: commitments must differ in kind, reasoning chain must switch inference modes, warning nodes must cite prior-graph shapes. Prevents the "three graphs describing the same arc with cosmetic variation" failure mode.

### Files
- `src/lib/ai/reasoning-graph.ts` — generators (`generateReasoningGraph`, `generateExpansionReasoningGraph`, `generateCoordinationPlan`)
- `src/lib/ai/reasoning-graph/mode-blocks.ts` — per-mode prompt blocks (anchor discipline, branch-set quality checks)
- `src/lib/ai/reasoning-graph/sequential-path.ts` — LLM-readable graph rendering + pattern/warning directive extraction
- `src/components/generation/ThinkingAnimation.tsx` — D3 visualisation of the four thinking modes (3-phase: collection → objective → building)
- `src/components/{canvas/ReasoningGraphView,generation/ReasoningGraphModal}.tsx` — arc graph visualisations

## Semantic Search & Embeddings

Every scene, beat, and proposition is embedded as a **1536-dimensional vector** using OpenAI's `text-embedding-3-small` model. These embeddings capture **meaning, not keywords** — searching for "betrayal" surfaces scenes of broken trust even when that exact word never appears.

### How It Works

1. **Hierarchical embedding**: Propositions (narrative claims), beats (prose sections), and full scenes are embedded with context (arc name, scene summary, beat function, surrounding prose)
2. **Cosine similarity search**: User queries are embedded and ranked against all stored embeddings
3. **AI synthesis**: Top results feed an LLM that produces a Google-style overview with inline citations `[1] [2] [3]`
4. **Narrative-scoped state**: Search results stored in app state per narrative, automatically clear when switching stories
5. **Incremental updates**: Embeddings regenerated only when narrative content changes

### Applications

- **Continuity validation** — When a scene references "the promise made at the river", semantic search retrieves all prior content close to that concept and verifies it exists
- **Knowledge asymmetry tracking** — If Character A acts on information they shouldn't have, search surfaces when that information was revealed and who was present
- **Intelligent RAG** — Generation retrieves semantically relevant prior content from anywhere in the timeline, enabling callbacks, foreshadowing validation, thematic coherence
- **Semantic space** — Thread convergence, character parallels, thematic echoes become queryable through cosine similarity

Future capabilities: plot hole detection (missing causal links), tone drift analysis (semantic clustering), automated continuity checks.

Files: `src/lib/search.ts`, `src/lib/embeddings.ts`, `src/lib/ai/search-synthesis.ts`, `src/components/canvas/SearchView.tsx`

## Scene Deltas

Every scene records structural changes to the knowledge graph. These deltas are the raw inputs to the force formulas — the forces are computed *from* the deltas, not from the prose.

### Thread Deltas → Fate
Threads are **prediction markets** over named outcomes. Each thread carries a question ("Will X happen?") and a set of outcomes (binary `["yes","no"]` or multi-outcome `["Stark","Lannister","Targaryen","nobody"]`); the market prices a probability distribution via per-outcome logits + softmax. Each scene records thread deltas as `{threadId, updates: [{outcome, evidence}], logType, volumeDelta, addOutcomes?, rationale}` — the LLM emits evidence in `[-4, +4]` per affected outcome (same scale as game-theory stake deltas), a `logType` from the nine perceptual primitives (pulse, setup, escalation, payoff, twist, resistance, stall, callback, transition), and an attention delta (`volumeDelta`). The math applies `logits[k] += evidence / sensitivity`, updates `volume` (geometric decay α=0.9 on untouched scenes) and `volatility` (EWMA on max shift), and may close the thread when `margin ≥ τ_effective` AND `logType ∈ {payoff, twist}` with `|evidence| ≥ 3`. Closure records `closeOutcome` and `resolutionQuality`; abandonment fires when volume decays below floor.

Fate per thread per scene is **information gain weighted by attention**: `|ΔH(probs)| × volume_weight`. The implementation uses the leading-order proxy `log(1 + peak_|evidence|) × (1 + log(1 + volumeDelta))` to avoid per-scene trajectory replay. Evidence magnitudes map to logType shapes: pulse (|e|≈0), setup (|e|≈1), resistance (|e|≈1–2), escalation (|e|≈2–3), twist (|e|≥3 reversal), payoff (|e|≈3–4 closing). Saturated markets (near certainty) contribute little fate; contested markets with high volume contribute most; twists against a committed leader contribute most of all. Each thread maintains a `threadLog` — an accumulated graph of the nine perceptual primitives across its lifespan.

### World Deltas
World deltas are additive changes to any entity's inner knowledge graph: `{entityId, addedNodes: [{id, content, type}], addedEdges: [{from, to, relation}]}`. Entities are characters, locations, or artifacts — each maintains its own world graph parallel to the system knowledge graph. World mirrors System but for entity inner worlds: `W = ΔN_w + √ΔE_w` — world nodes linear, world edges sqrt.

### System Deltas
The system knowledge graph tracks laws, systems, concepts, and tensions as nodes with typed edges. System is computed as `S = ΔN + √ΔE` — nodes linear, edges sqrt.

## Narrative Forces & Formulas

Three force dimensions, all **z-score normalised** (mean=0, units=standard deviations):

- **Fate (F)** — `Σ log(1 + peak_|evidence|) × (1 + log(1 + volumeDelta))` — leading-order proxy for `|ΔH(probs)| × volume_weight`; payoffs/twists (|e|≈4) saturate near 1.6, setups (|e|≈1) score ~0.7, pulses (|e|=0 with volume) score >0, stalls score 0
- **World (W)** — `ΔN_w + √ΔE_w` — entity world graph complexity
- **System (S)** — `ΔN + √ΔE` — world knowledge graph complexity

Derived metrics:
- **Delivery** — `(F + W + S) / 3` — equal-weighted mean of z-scored forces
- **Swing** — Euclidean distance between consecutive force snapshots

Formulas in `src/lib/narrative-utils.ts`. The **cube** model maps forces into 3D space for trajectory analysis.

## Markov Chain Pacing (src/lib/pacing-profile.ts)

Scene generation is guided by **Markov chain sequences** sampled as per-scene directions. This separates *what happens* (LLM) from *how intense it is* (math).

**Flow:**
1. Detect current mode from the last scene's force snapshot
2. Sample a sequence of cube modes from a transition matrix (or use a preset)
3. Build a prompt with per-scene mode assignments and delta guidance
4. LLM generates scenes with deltas matching each mode's targets

**Transition matrices** are computed from analysed works (Harry Potter is the default). Each matrix captures the pacing fingerprint of a published work.

**Pacing presets** are curated fixed sequences that bypass Markov sampling:
- 3-scene: Sucker Punch, Quick Resolve, Crucible
- 5-scene: Classic Arc, Unravelling, Pressure Cooker, Inversion, Deep Dive
- 8-scene: Introduction, Full Arc, Slow Burn, Roller Coaster, Revelation Arc, Gauntlet

## Prose Profiles & Beat Plans (src/lib/beat-profiles.ts, scripts/analyze-prose.js)

Prose generation is guided by **beat plans** — structured blueprints that decompose each scene into typed beats before any prose is written. Plans are reverse-engineered from published works by having an LLM analyze existing prose against a fixed taxonomy, then building statistical profiles from the extracted plans.

**10 Beat Functions** (what the beat does):
- **breathe** — pacing, atmosphere, sensory grounding, scene establishment
- **inform** — knowledge delivery, a character or reader learns something now
- **advance** — forward momentum, plot moves, goals pursued, tension rises
- **bond** — relationship shifts between characters (trust, suspicion, alliance)
- **turn** — scene pivots, a revelation reframes everything, an interruption changes direction
- **reveal** — character nature exposed through action or choice
- **shift** — power dynamic inverts, leverage changes hands
- **expand** — world-building, new rule/system/geography introduced
- **foreshadow** — plants information that pays off later
- **resolve** — tension releases, question answered, conflict settles

**8 Mechanisms** (how the beat is delivered as prose):
- **dialogue** — conversation with subtext
- **thought** — internal monologue, POV character's private reasoning
- **action** — physical movement, gesture, interaction with objects
- **environment** — setting, weather, lighting, sensory details
- **narration** — authorial commentary, rhetorical structures
- **memory** — flashback triggered by association
- **document** — embedded text (letter, newspaper, sign, excerpt)
- **comic** — humor, irony, absurdity, bathos

**Analysis pipeline** (`scripts/analyze-prose.js`):
1. LLM extracts beat plans from existing prose scenes (fn + mechanism + what + anchor per beat)
2. Count beat function and mechanism distributions across all scenes
3. Build **Markov transition matrices** over beat functions (fn→fn probabilities)
4. Compute beatsPerKWord density metric
5. Output a `ProseProfile` (voice: register, stance, devices, rules) + `BeatSampler` (markov, mechanismDistribution, beatsPerKWord)

**Presets** are derived from analysed works at runtime. The "self" preset computes a live profile from the current narrative's own scene plans. When `useBeatChain` is enabled, plan generation samples the beat function sequence from the profile's Markov chain rather than choosing freely.

## Planning with Course Correction (src/lib/ai/review.ts)

Stories are divided into **phases** with objectives and scene allocations. When a phase activates, direction and constraint vectors are generated. After every arc, a **course correction** pass rewrites the vectors based on thread tension, character cost, rhythm, freshness, and momentum. At phase boundaries, world expansion introduces new entities seeded with knowledge asymmetries.

## Iterative Revision (src/lib/ai/evaluate.ts, reconstruct.ts)

**Evaluation** reads scene summaries and assigns per-scene verdicts:
- **ok** — structurally sound, continuity intact
- **edit** — revise content — may change POV, location, participants, deltas, summary
- **merge** — absorbed into another scene, combining both into one denser beat
- **insert** — new scene generated to fill a pacing gap, missing transition, or stalled thread
- **cut** — redundant, remove entirely (to relocate a scene: cut + insert at new position)

**Reconstruction** creates a new versioned branch (v2, v3, v4...), applying verdicts in parallel. World commits pass through at original positions. Supports external guidance (paste feedback from another AI or human editor). Converges in 2–3 passes.

## Version Control

InkTide implements two distinct versioning systems:

**Branch Reconstruction Versioning**: The revision pipeline creates new branch versions (main-v2, main-v3, main-v4) through the review → reconstruct cycle. Each reconstruction pass evaluates the entire branch, applies structural edits across multiple scenes, and produces a new versioned branch. These branch versions represent complete narrative revisions where the system has reevaluated story structure, pacing, and continuity across the full timeline. Reconstruction is destructive iteration — you get a new branch with changes applied, not a document you can incrementally edit.

**Prose & Plan Content Versioning**: Separate from branch reconstruction, individual scenes track prose and plan versions with semantic numbering `v1.2.3`:
- **Generate** (major): `1`, `2`, `3` — fresh generation from plan/scratch
- **Rewrite** (minor): `1.1`, `1.2`, `2.1` — LLM-guided revision with critique
- **Edit** (patch): `1.1.1`, `1.1.2` — manual or minor tweaks

This is document-style version history. You can edit the original text while keeping all previous versions safe. Resolution functions (`resolveProseForBranch`, `resolvePlanForBranch`) determine which version each branch sees based on lineage, fork timestamps, and optional branch-specific version pointers.

**Structural Branching**: Beneath both versioning systems, scenes themselves are structurally immutable (POV, location, participants, deltas fixed). Branches fork from parents and inherit their timeline via `entryIds` arrays. Storage is efficient — shared scenes are referenced, not copied. Only structurally different scenes (new generations, structural edits) create new scene objects. Descendants dynamically resolve their view through parent lineage at read time, enabling git-like cloning with minimal storage overhead.

## Auto Mode Engine (src/lib/auto-engine.ts)

Automated story generation guided by **narrative pressure analysis** across the three forces. The engine evaluates thread management, entity development, and world knowledge to create peaks and valleys in the delivery curve.

**Story Phases**: Progress maps to six phases — `setup → rising → midpoint → escalation → climax → resolution`. Each phase has guidance for what should happen structurally (e.g., "setup" plants seeds, "climax" resolves critical threads).

**Pressure Analysis** evaluates:
- **Threads** — stale threads (no recent delta), primed threads (escalating/critical ready for payoff), active count vs ideal range
- **Entities** — shallow characters (low world depth), neglected anchors (not appearing recently), recent world growth
- **Knowledge** — system growth rate, world-building stagnation
- **Balance** — which force is dominant, recommendation to rebalance

**Directive Building**: The engine produces a directive string that guides scene generation. It includes phase guidance, thread management priorities, character development needs, and user-provided direction/constraints.

**Arc Length Selection**: Primed threads → shorter focused arcs. Too many active threads → medium arcs. Character development needed → longer arcs with breathing room.

**Planning Queue Integration**: When a planning queue is active, auto mode respects phase allocations and yields to the planning layer for phase transitions. The planning queue defines objectives; auto mode executes with force-aware pacing.

## AI Pipeline (src/lib/ai/)

All LLM calls go through `callGenerate` (non-streaming) or `callGenerateStream` (streaming) in `api.ts`, which hit `/api/generate`.

Key functions:
- `generateNarrative()` — full world + 8-scene introduction arc (wizard)
- `generateScenes()` — scene structures with deltas, paced by Markov sequence
- `generateScenePlan()` — beat-by-beat blueprint (streaming)
- `generateSceneProse()` — full prose from plan (streaming)
- `rewriteSceneProse()` — rewrite guided by critique or custom analysis
- `expandWorld()` — add characters, locations, threads
- `refreshDirection()` — course correction after each arc
- `reviewBranch()` — summary-based branch evaluation with optional guidance
- `reconstructBranch()` — versioned branch reconstruction from verdicts

## Environment Variables

```
OPENROUTER_API_KEY=         # Required — LLM API access
REPLICATE_API_TOKEN=        # Optional — image generation (Seedream 4.5)
NEXT_PUBLIC_USER_API_KEYS=  # Optional — allow user-provided keys
```

## Constants (src/lib/constants.ts)

Key tuning values:
- `PROSE_CONCURRENCY = 10` — parallel prose generation
- `PLAN_CONCURRENCY = 10` — parallel plan generation
- `ANALYSIS_CONCURRENCY = 20` — parallel text analysis chunks
- `DEFAULT_CONTEXT_SCENES = 50` — default branch time horizon (overridden per-story in settings)
- `MCTS_MAX_NODE_CHILDREN = 8` — MCTS branching factor
- `AUTO_STOP_CYCLE_LENGTH = 25` — auto-engine arc limit
