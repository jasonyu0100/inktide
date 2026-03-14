# Narrative Engine

A knowledge-graph-based narrative analysis and generation platform that derives the power of stories through scene-level mutation tracking, evaluating metrics on **payoff**, **change**, and **variety** across narrative forces.

## How It Works

Narratives are modelled as a **knowledge graph** — characters, locations, threads, and relationships — that mutates scene by scene. An LLM records structural mutations at each scene, and static analysis formulas compute **narrative forces** from those mutations. This creates a quantitative foundation for understanding what makes narratives compelling.

### Knowledge Graph Mutations

Every scene records changes to the narrative world:

- **Thread mutations** — how plot threads advance, complicate, or resolve
- **Knowledge mutations** — what characters learn or reveal
- **Relationship mutations** — how connections between characters shift

### Narrative Forces

Three force dimensions are derived from mutation analysis:

- **Payoff** — how well setups are resolved and threads are paid off
- **Change** — magnitude of state transitions in the knowledge graph per scene
- **Variety** — diversity of mutation types and narrative elements engaged

These forces map into a **3D cube model** for trajectory analysis, comparative scoring, and visualisation.

## Features

### MCTS Narrative Search

A Monte Carlo Tree Search implementation explores possible narrative branches and optimises for narrative force trajectories — finding story paths that maximise payoff, change, and variety.

### Slides (Series Walkthrough)

An interactive presentation that walks through a series' peaks, valleys, and turning points with in-depth force analysis, decomposition charts, and statistical breakdowns.

### Analysis Engine

Compiles existing text or narratives into the knowledge graph model using a **window function** for efficient, continuous chunk-by-chunk processing. Extracts arcs and scenes with their mutations from raw prose.

### Analysis Modes

- **Cube Trajectory** — 3D visualisation of force paths through narrative space
- **Explorer** — interactive knowledge graph exploration
- **Force Charts** — stock-type time-series analysis of narrative forces over scenes

### World Building

Arc-based world expansion that adds characters, locations, and threads to the existing narrative world, growing the knowledge graph organically.

### Scene Generation & Prose

Full generation pipeline: scene structure → beat-by-beat plan → prose → grading → rewriting. Prose is scored across 6 dimensions with LLM-generated critique.

### Additional

- **Branching Timelines** — git-like branches for exploring alternate storylines
- **Auto-Generation** — automated story generation with configurable constraints
- **EPUB Export** — export your narrative as a publishable ebook
- **Character Movements** — track how characters physically relocate between locations

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
- **Visualization:** [D3.js](https://d3js.org) (force-directed graphs, charts, cube trajectories)
- **AI:** [OpenRouter](https://openrouter.ai/) API (streaming LLM generation)
- **Images:** [Replicate](https://replicate.com/) API (cover & scene art)
- **Language:** TypeScript (strict mode)

## Project Structure

```
src/
├── app/                    # Next.js routes & API endpoints
│   ├── series/[id]/        # Main story editor workspace
│   ├── analysis/           # Text-to-narrative extraction pipeline
│   └── api/                # LLM, image, and idea generation endpoints
├── components/
│   ├── canvas/             # WorldGraph — interactive knowledge graph
│   ├── timeline/           # TimelineStrip, ForceCharts — scene timeline & force analysis
│   ├── movie/              # Slides — series walkthrough presentation
│   ├── mcts/               # MCTSPanel — narrative force optimisation
│   ├── analytics/          # ForceTracker — stock-type force metrics
│   ├── topbar/             # CubeExplorer, FormulaModal — cube & formula views
│   ├── story/              # StoryReader — prose reading/grading/rewriting
│   ├── generation/         # GeneratePanel — scene generation
│   └── ...
├── lib/
│   ├── ai.ts               # LLM calls — generation, scoring, mutation recording
│   ├── narrative-utils.ts   # Force calculation formulas, cube logic, graph algorithms
│   ├── text-analysis.ts     # Corpus → knowledge graph extraction (window-function chunking)
│   ├── mcts-engine.ts       # MCTS — optimises narrative force trajectories
│   ├── auto-engine.ts       # Automated generation loop
│   └── ...
├── types/
│   └── narrative.ts         # Domain types: Scene, Character, Thread, Arc, etc.
└── data/                    # Seed narratives (HP, LOTR, Star Wars, Reverend Insanity)
```

## License

Private
