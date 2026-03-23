# Narrative Engine

Knowledge-graph-based narrative analysis and generation platform. Derives the power of narratives through scene-level mutation tracking, computing **payoff**, **change**, and **knowledge** forces from knowledge graph mutations. Next.js 16 + React 19 + TypeScript.

## Core Concept

Narratives are modelled as a **knowledge graph** that mutates scene by scene. An LLM records structural mutations (threads, knowledge, relationships) at each scene, and static analysis formulas compute **narrative forces** from those mutations. This enables:

- **Markov chain pacing** — transition matrices derived from published works shape scene-by-scene rhythm
- **MCTS search** that optimises narrative force trajectories to find the strongest possible story paths
- **Pacing presets** — curated cube position sequences that bypass Markov sampling for targeted arcs
- **Slides** that walk through a series' peaks, valleys, and force analysis
- **Analysis engine** that compiles existing text into arcs and scenes via chunked window-function processing
- **Multiple analysis modes**: cube trajectory, explorer, and stock-type force charts

## Quick Reference

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

- **Frontend:** Next.js App Router, React 19, Tailwind CSS v4, D3.js
- **AI:** OpenRouter API (streaming) — raw HTTP, no SDK. Models: Gemini 2.5 Flash (default/analysis/generation), Gemini 3 Flash Preview (writing)
- **Images:** Replicate API via `/api/generate-image`, `/api/generate-cover`
- **State:** React Context + useReducer in `src/lib/store.tsx`
- **Persistence:** localStorage via `src/lib/persistence.ts`
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
│   ├── inspector/          # SidePanel — entity detail views
│   ├── timeline/           # TimelineStrip, ForceCharts, NarrativeCubeViewer
│   ├── topbar/             # TopBar, CubeExplorer, FormulaModal
│   ├── generation/         # GeneratePanel, BranchModal, PacingStrip, MarkovGraph
│   ├── analytics/          # ForceTracker — stock-type force analysis
│   ├── auto/               # AutoControlBar, AutoSettingsPanel
│   ├── mcts/               # MCTSPanel, MCTSControlBar
│   ├── slides/             # SlidesPlayer + individual slide components
│   ├── sidebar/            # SeriesPicker, ThreadPortfolio, MediaDrive
│   ├── layout/             # AppShell, ApiKeyModal, RulesPanel
│   ├── wizard/             # CreationWizard — new story flow
│   └── chat/               # ChatPanel
├── lib/                    # Core logic
│   ├── ai/                 # LLM calls (modularised)
│   │   ├── api.ts          # callGenerate, callGenerateStream
│   │   ├── context.ts      # branchContext, sceneContext — LLM context building
│   │   ├── scenes.ts       # generateScenes, generateScenePlan
│   │   ├── prose.ts        # scoreSceneProse, rewriteSceneProse
│   │   ├── world.ts        # expandWorld, suggestDirection, generateNarrative
│   │   ├── prompts.ts      # Modular prompt sections (force standards, pacing, mutations, POV, continuity)
│   │   └── json.ts         # JSON parsing utilities
│   ├── narrative-utils.ts  # Force calculation formulas, cube logic, graph algorithms
│   ├── markov.ts           # Markov chain pacing — transition matrices, sequence sampling, presets, prompt generation
│   ├── store.tsx           # State management + reducer actions
│   ├── text-analysis.ts    # Corpus → NarrativeState extraction (window-function chunking)
│   ├── auto-engine.ts      # Automated story generation loop
│   ├── mcts-engine.ts      # MCTS scene exploration
│   ├── mcts-state.ts       # MCTS state management
│   ├── slides-data.ts      # Slide generation logic
│   ├── constants.ts        # All tunable config values
│   ├── persistence.ts      # localStorage read/write
│   ├── epub-export.ts      # EPUB export
│   └── api-logger.ts       # API call logging & token tracking
├── types/
│   ├── narrative.ts        # Domain types: Scene, Character, Location, Thread, Arc, ProseScore, CubeCorner, etc.
│   └── mcts.ts             # MCTS-specific types
├── hooks/                  # useAutoPlay, useMCTS, useFeatureAccess
└── data/                   # Seed narratives (HP, LOTR, Star Wars, GoT, Reverend Insanity)
```

## Domain Model (src/types/narrative.ts)

- **NarrativeState** — top-level: characters, locations, threads, arcs, scenes, worldBuilds, branches
- **Scene** — povId, locationId, participantIds, events, threadMutations, knowledgeMutations, relationshipMutations, characterMovements, plan, prose, proseScore
- **Thread** — trackable narrative threads with lifecycle status; mutations record payoff/change per scene
- **Branch/Commit** — git-like branching for story timelines
- **Arc** — world-building arcs that group scenes and expand the narrative world
- **CubeCorner** — one of 8 narrative modes (Epoch, Climax, Revelation, Closure, Discovery, Growth, Lore, Rest) defined by high/low combinations of the three forces

## Narrative Forces & Formulas

Three force dimensions derived from knowledge graph mutations, all **z-score normalised** (mean=0, units=standard deviations):

- **Payoff (P)** — thread phase transitions weighted by jump magnitude. Formula: `Σ |φ_to - φ_from|`. Phase indices: dormant(0) → active(1) → escalating(2) → critical(3) → resolved/subverted/abandoned(4). Small pulse reward (0.25) for same-status mentions.
- **Change (C)** — mutation intensity. Formula: `√M_c + √|E|` where M_c = continuity mutations and |E| = event count. Square root scaling allows dense scenes to spike meaningfully above sparse ones. Cast-blind.
- **Knowledge (K)** — world knowledge graph complexity delta per scene. Formula: `K = ΔN + √ΔE`. Nodes linear (each new concept = 1), edges sqrt (first connections matter more than bulk linking).

Derived metrics:
- **Tension** — `T = C + K - P`, buildup without release — the coiled spring
- **Delivery** — `E = 0.5P + 0.5·tanh(C/2) + 0.5·tanh(K/2) + 0.3·contrast`, payoff linear, C/K saturated via tanh to prevent ensemble inflation. `contrast = max(0, T[i-1] - T[i])` rewards tension-release scenes
- **Swing** — Euclidean distance between consecutive force snapshots

Formulas in `src/lib/narrative-utils.ts`, inspectable via `FormulaModal`. The **cube** model maps forces into 3D space for trajectory analysis.

## Narrative Cube (8 Modes)

Each scene is classified into one of 8 modes based on which forces are above (H) or below (L) the mean:

| Key | Name | Forces | Role |
|-----|------|--------|------|
| HHH | Epoch | P↑ C↑ K↑ | Everything converges — the defining moment |
| HHL | Climax | P↑ C↑ K↓ | Threads resolve, characters transform within established rules |
| HLH | Revelation | P↑ C↓ K↑ | World-building unlocks resolution |
| HLL | Closure | P↑ C↓ K↓ | Quiet resolution, tying loose ends |
| LHH | Discovery | P↓ C↑ K↑ | Characters transform through new world systems |
| LHL | Growth | P↓ C↑ K↓ | Internal character development |
| LLH | Lore | P↓ C↓ K↑ | Pure world-building, planting seeds |
| LLL | Rest | P↓ C↓ K↓ | Recovery and breathing room |

## Markov Chain Pacing (src/lib/markov.ts)

Scene generation is guided by **Markov chain sequences** that determine the pacing rhythm before the LLM generates content. This separates *what happens* (LLM) from *how intense it is* (math).

**Flow:**
1. Detect current mode from the last scene's force snapshot
2. Sample a sequence of cube modes from a transition matrix (or use a preset)
3. Build a prompt with per-scene mode assignments and mutation guidance
4. LLM generates scenes with mutations matching each mode's targets

**Transition matrices** are computed from analysed works (Harry Potter is the default). Each matrix captures the pacing fingerprint of a published work — how often it transitions between modes.

**Pacing presets** are curated fixed sequences that bypass Markov sampling:
- 3-scene: Sucker Punch, Quick Resolve, Crucible
- 5-scene: Classic Arc, Unravelling, Pressure Cooker, Inversion, Deep Dive
- 8-scene: Introduction, Full Arc, Slow Burn, Roller Coaster, Revelation Arc, Gauntlet

**Introduction sequence** (used by the wizard for new stories): Rest → Lore → Growth → Discovery → Lore → Growth → Discovery → Climax. Designed to showcase varied locations and build to a first climax.

The **sequence prompt** (`buildSequencePrompt`) tells the LLM the formulas, per-mode mutation guidance (what kind and how many mutations each mode requires), and force targets. The LLM knows that "the mutations you generate ARE the forces."

## AI Pipeline (src/lib/ai/)

All LLM calls go through `callGenerate` (non-streaming) or `callGenerateStream` (streaming) in `api.ts`, which hit `/api/generate`.

Key functions across modules:
- `generateNarrative()` — full world + 8-scene introduction arc (wizard)
- `generateScenes()` — scene structures with mutations, paced by Markov sequence
- `generateScenePlan()` — beat-by-beat blueprint (streaming)
- `generateSceneProse()` — full prose from plan (streaming)
- `scoreSceneProse()` — returns ProseScore with critique
- `rewriteSceneProse()` — rewrite guided by critique or custom analysis
- `expandWorld()` — add characters, locations, threads

## Environment Variables

```
OPENROUTER_API_KEY=         # Required — LLM API access
REPLICATE_API_TOKEN=        # Optional — image generation
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
