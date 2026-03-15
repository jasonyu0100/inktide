# Narrative Engine

A knowledge-graph-based narrative analysis and generation platform that derives the power of stories through scene-level mutation tracking, computing **payoff**, **change**, and **knowledge** forces from knowledge graph mutations.

## How It Works

Narratives are modelled as a **knowledge graph** — characters, locations, threads, and relationships — that mutates scene by scene. An LLM records structural mutations at each scene, and static analysis formulas compute **narrative forces** from those mutations.

### Knowledge Graph Mutations

Every scene records changes to the narrative world:

- **Thread mutations** — how plot threads advance, complicate, or resolve
- **Knowledge mutations** — what characters learn or reveal (new concepts and connections)
- **Relationship mutations** — how connections between characters shift

### Narrative Forces

Three force dimensions derived from mutations, all **z-score normalised**:

- **Payoff (P)** — thread phase transitions weighted by jump magnitude, plus relationship valence deltas. `Σ |φ_to - φ_from| + Σ |Δv|`
- **Change (C)** — mutation reach per character with logarithmic scaling. `Σ_c log₂(1 + m_c)`
- **Knowledge (K)** — world knowledge graph complexity delta. `K = ΔN + 0.5 · ΔE`

Derived metrics:
- **Delivery** — `(P + C + K) / 3`, Gaussian-smoothed overall narrative presence
- **Tension** — `C + K - P`, buildup without release
- **Swing** — Euclidean distance between consecutive force snapshots

These forces map into a **3D cube model** for trajectory analysis, comparative scoring, and visualisation.

## Features

- **MCTS Narrative Search** — Monte Carlo Tree Search explores narrative branches, optimising force trajectories
- **Slides** — interactive walkthrough of a series' peaks, valleys, and force decomposition
- **Analysis Engine** — compiles existing text into the knowledge graph via window-function chunking
- **Analysis Modes** — cube trajectory (3D force paths), explorer (interactive graph), force charts (stock-type time-series)
- **Scene Generation** — full pipeline: scene structure → beat-by-beat plan → prose → grading → rewriting
- **World Building** — arc-based expansion of characters, locations, and threads
- **Branching Timelines** — git-like branches for alternate storylines
- **Auto-Generation** — automated story generation with configurable constraints
- **EPUB Export** — export as a publishable ebook

## Getting Started

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) API key

### Setup

```bash
npm install
```

Create a `.env.local` file:

```
OPENROUTER_API_KEY=your_key_here
REPLICATE_API_TOKEN=your_token_here   # Optional, for image generation
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start analysing and generating narratives.

### Production

```bash
npm run build
npm start
```

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router)
- **UI:** React 19, [Tailwind CSS](https://tailwindcss.com) v4
- **Visualisation:** [D3.js](https://d3js.org) (force-directed graphs, charts, cube trajectories)
- **AI:** [OpenRouter](https://openrouter.ai/) API (Gemini 2.5/3 Flash models, streaming)
- **Images:** [Replicate](https://replicate.com/) API (cover & scene art)
- **Language:** TypeScript

## Project Structure

```
src/
├── app/                    # Next.js routes & API endpoints
│   ├── series/[id]/        # Main story editor workspace
│   ├── analysis/           # Text-to-narrative extraction pipeline
│   └── api/                # LLM, image, and idea generation endpoints
├── components/             # React UI (organized by feature area)
│   ├── canvas/             # WorldGraph — interactive knowledge graph
│   ├── timeline/           # TimelineStrip, ForceCharts, NarrativeCubeViewer
│   ├── slides/             # SlidesPlayer — series walkthrough presentation
│   ├── mcts/               # MCTSPanel — narrative force optimisation
│   ├── analytics/          # ForceTracker — stock-type force metrics
│   ├── topbar/             # CubeExplorer, FormulaModal
│   ├── story/              # StoryReader — prose reading/grading/rewriting
│   ├── generation/         # GeneratePanel — scene generation
│   └── ...
├── lib/
│   ├── ai/                 # LLM calls (modularised: api, context, scenes, prose, world, json)
│   ├── narrative-utils.ts  # Force calculation formulas, cube logic, graph algorithms
│   ├── text-analysis.ts    # Corpus → knowledge graph extraction (window-function chunking)
│   ├── mcts-engine.ts      # MCTS — optimises narrative force trajectories
│   ├── auto-engine.ts      # Automated generation loop
│   └── ...
├── types/
│   ├── narrative.ts        # Domain types: Scene, Character, Thread, Arc, etc.
│   └── mcts.ts             # MCTS-specific types
└── data/                   # Seed narratives (HP, LOTR, Star Wars, GoT, Reverend Insanity)
```

## License

Private
