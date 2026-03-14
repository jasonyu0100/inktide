# Narrative Engine

Knowledge-graph-based narrative analysis and generation platform. Derives the power of narratives through scene-level mutation tracking, evaluating metrics on payoff, change, and variety across narrative forces. Next.js 16 + React 19 + TypeScript.

## Core Concept

Narratives are modelled as a **knowledge graph** that mutates scene by scene. An LLM records structural mutations (threads, knowledge, relationships) at each scene, and static analysis formulas compute **narrative forces** — payoff, change, and variety — from those mutations. This enables:

- **MCTS search** that optimises narrative force trajectories to find the strongest possible story paths
- **Slides** (walkthrough presentation) that guide through a series' peaks, valleys, and in-depth force analysis
- **Analysis engine** that compiles existing text/narratives into arcs and scenes via chunked window-function processing
- **Multiple analysis modes**: cube trajectory, explorer, and stock-type force charts

## Quick Reference

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

- **Frontend:** Next.js App Router, React 19, Tailwind CSS v4, D3.js
- **AI:** OpenRouter API (streaming) — no SDK, raw HTTP in `/api/generate`
- **Images:** Replicate API via `/api/generate-image`, `/api/generate-cover`
- **State:** React Context + useReducer in `src/lib/store.tsx` — no Redux/Zustand
- **Persistence:** localStorage via `src/lib/persistence.ts`
- **Types:** Domain model in `src/types/narrative.ts`, config in `src/lib/constants.ts`

## Key Directories

```
src/
├── app/                    # Next.js routes & API endpoints
│   ├── series/[id]/        # Main story editor workspace
│   ├── analysis/           # Text-to-narrative extraction pipeline
│   └── api/                # generate, chat, generate-image, generate-cover, random-idea, suggest-premise
├── components/             # React UI (organized by feature area)
│   ├── story/              # StoryReader — prose reading/grading/rewriting
│   ├── canvas/             # WorldGraph — interactive entity/knowledge graph
│   ├── inspector/          # SidePanel — entity detail views
│   ├── timeline/           # TimelineStrip, ForceCharts — scene timeline & force analysis
│   ├── topbar/             # TopBar, CubeExplorer, FormulaModal — header controls & formula inspection
│   ├── generation/         # GeneratePanel, BranchModal — scene generation
│   ├── analytics/          # ForceTracker — narrative force metrics (stock-type analysis)
│   ├── auto/               # AutoControlBar — automated generation
│   ├── mcts/               # MCTSPanel — Monte Carlo Tree Search for narrative force optimisation
│   ├── movie/              # Slides — walkthrough presentation of series peaks, valleys & force analysis
│   │   └── slides/         # TitleSlide, SegmentSlide, PeakSlide, TroughSlide, ForceDecomposition, etc.
│   ├── wizard/             # CreationWizard — new story flow
│   └── ...
├── lib/                    # Core logic
│   ├── ai.ts               # LLM calls — generation, scoring, rewriting, mutation recording (~3500 LOC)
│   ├── store.tsx            # State management + reducer actions
│   ├── narrative-utils.ts   # Force calculation formulas, cube logic, graph algorithms
│   ├── text-analysis.ts     # Corpus → NarrativeState extraction pipeline (window-function chunking)
│   ├── auto-engine.ts       # Automated story generation loop
│   ├── mcts-engine.ts       # MCTS scene exploration — optimises narrative forces
│   ├── constants.ts         # All tunable config values
│   ├── epub-export.ts       # EPUB export
│   └── persistence.ts       # localStorage read/write
├── types/
│   └── narrative.ts         # Domain types: Scene, Character, Location, Thread, Arc, ProseScore, etc.
└── data/                    # Seed narratives (HP, LOTR, Star Wars, Reverend Insanity)
```

## Domain Model (src/types/narrative.ts)

Core types to know:

- **NarrativeState** — top-level: characters, locations, threads, arcs, scenes, worldBuilds, branches
- **Scene** — has povId, locationId, participantIds, events, threadMutations, knowledgeMutations, relationshipMutations, characterMovements, plan, prose, proseScore
- **CharacterMovement** — `{ locationId: string; transition: string }` — tracks HOW characters physically relocate
- **ProseScore** — 6-dimension grading (voice, pacing, dialogue, sensory, mutation_coverage, overall) + critique string
- **Branch/Commit** — git-like branching for story timelines
- **Arc** — world-building arcs that group scenes and expand the narrative world
- **Thread** — trackable narrative threads with lifecycle status; mutations record payoff/change per scene

## Narrative Forces & Formulas

The system computes narrative power through three force dimensions derived from knowledge graph mutations:

- **Payoff** — how well setups are resolved and threads are paid off
- **Change** — magnitude of state transitions in the knowledge graph per scene
- **Variety** — diversity of mutation types and narrative elements engaged

Formulas are baked into `src/lib/narrative-utils.ts` and inspectable via `FormulaModal`. The **cube** model maps these three forces into a 3D space, enabling trajectory analysis and comparative scoring.

## AI Pipeline (src/lib/ai.ts)

All LLM calls go through `callGenerate` (non-streaming) or `callGenerateStream` (streaming), which hit `/api/generate`.

Key functions:
- `generateScenes()` — creates scene structures with mutations from narrative state
- `generateScenePlan()` — beat-by-beat blueprint (streaming)
- `generateSceneProse()` — full prose from plan (streaming)
- `scoreSceneProse()` — grade-only, returns ProseScore with critique
- `rewriteSceneProse()` — rewrite guided by grade critique or custom analysis
- `expandWorld()` — add characters, locations, threads (world-building arcs)
- `reconcileScenePlans()` — cross-scene coherence check

## Analysis Engine (src/lib/text-analysis.ts)

Compiles existing narratives or text into the knowledge graph model:
- Chunks text into processable segments using a **window function** for efficient, continuous analysis
- Extracts arcs and scenes with their mutations from raw prose
- Supports multiple analysis modes: **cube trajectory** (3D force path), **explorer** (interactive graph), and **stock-type force charts** (time-series force analysis)

## MCTS Engine (src/lib/mcts-engine.ts)

Monte Carlo Tree Search implementation that explores possible narrative branches and optimises for narrative force trajectories. Uses the force formulas to evaluate candidate scenes and select paths that maximise payoff, change, and variety.

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
- `MAX_CONTEXT_SCENES = 100` — sliding window for LLM context
- `MCTS_MAX_NODE_CHILDREN = 8` — MCTS branching factor
- `AUTO_STOP_CYCLE_LENGTH = 25` — auto-engine arc limit
