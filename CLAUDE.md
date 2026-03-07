# Narrative Engine

AI-powered interactive fiction editor. Next.js 16 + React 19 + TypeScript.

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
│   ├── canvas/             # WorldGraph — interactive entity graph
│   ├── inspector/          # SidePanel — entity detail views
│   ├── timeline/           # TimelineStrip, ForceCharts — scene timeline
│   ├── topbar/             # TopBar, CubeExplorer — header controls
│   ├── generation/         # GeneratePanel, BranchModal — scene generation
│   ├── analytics/          # ForceTracker — narrative tension metrics
│   ├── auto/               # AutoControlBar — automated generation
│   ├── mcts/               # MCTSPanel — Monte Carlo Tree Search
│   ├── wizard/             # CreationWizard — new story flow
│   └── ...
├── lib/                    # Core logic
│   ├── ai.ts               # LLM calls — generation, scoring, rewriting (~3500 LOC)
│   ├── store.tsx            # State management + reducer actions
│   ├── narrative-utils.ts   # Force calculation, cube logic, graph algorithms
│   ├── text-analysis.ts     # Corpus → NarrativeState extraction pipeline
│   ├── auto-engine.ts       # Automated story generation loop
│   ├── mcts-engine.ts       # MCTS scene exploration
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

## AI Pipeline (src/lib/ai.ts)

All LLM calls go through `callGenerate` (non-streaming) or `callGenerateStream` (streaming), which hit `/api/generate`.

Key functions:
- `generateScenes()` — creates scene structures with mutations from narrative state
- `generateScenePlan()` — beat-by-beat blueprint (streaming)
- `generateSceneProse()` — full prose from plan (streaming)
- `scoreSceneProse()` — grade-only, returns ProseScore with critique
- `rewriteSceneProse()` — rewrite guided by grade critique or custom analysis
- `expandWorld()` — add characters, locations, threads
- `reconcileScenePlans()` — cross-scene coherence check

## Important Conventions

- **Mutations are structural** — threadMutations, knowledgeMutations, relationshipMutations define WHAT changes. Plans/prose describe HOW. Never modify mutations during reconciliation or rewriting.
- **characterMovements** use `CharacterMovement` objects (`{locationId, transition}`), not plain strings. The sanitizer in `ai.ts` handles legacy string format.
- **Grading is separate from rewriting** — grade first (scoreSceneProse), then rewrite using the critique or custom 3rd-party analysis (rewriteSceneProse).
- **Prose scores** are defensive — `Number()` parsed, `typeof overall === 'number'` guarded.
- **Scene generation** JSON is sanitized — hallucinated character/location/thread IDs are stripped.

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
