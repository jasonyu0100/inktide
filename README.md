# Narrative Engine

An AI-powered interactive fiction editor for building, analyzing, and generating complex multi-threaded narratives. Create rich stories with interconnected characters, locations, and plot threads — then let AI help you plan scenes, write prose, and explore branching storylines.

## Features

- **Scene Generation** — AI creates structured scenes with character interactions, thread mutations, knowledge changes, and relationship shifts
- **Plan & Prose Pipeline** — Beat-by-beat scene blueprints, then full prose generation with streaming output
- **Grading & Rewriting** — Score prose on 6 dimensions (voice, pacing, dialogue, sensory, mutation coverage) with detailed critique, then rewrite using the grade or custom analysis
- **Interactive World Graph** — D3-powered visualization of characters, locations, and their relationships
- **Text Analysis** — Import existing prose (books, screenplays) and extract a full narrative graph: characters, locations, threads, scenes
- **Branching Timelines** — Git-like branches for exploring alternate storylines
- **Narrative Forces** — Track tension, change, and variety metrics across your story arc
- **Narrative Cube** — Classify scenes by payoff/change/variety into archetypal corners (Spectacle, Revelation, Convergence, etc.)
- **MCTS Exploration** — Monte Carlo Tree Search for discovering optimal scene sequences
- **Auto-Generation** — Automated story generation with configurable constraints
- **EPUB Export** — Export your narrative as a publishable ebook
- **Character Movements** — Track how characters physically relocate between locations with vivid transition descriptions

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

Open [http://localhost:3000](http://localhost:3000) to start creating narratives.

### Production

```bash
npm run build
npm start
```

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router)
- **UI:** React 19, [Tailwind CSS](https://tailwindcss.com) v4
- **Visualization:** [D3.js](https://d3js.org) (force-directed graphs, charts)
- **AI:** [OpenRouter](https://openrouter.ai/) API (streaming LLM generation)
- **Images:** [Replicate](https://replicate.com/) API (cover & scene art)
- **Language:** TypeScript (strict mode)

## Project Structure

```
src/
├── app/                # Next.js routes & API endpoints
│   ├── series/[id]/    # Main story editor
│   ├── analysis/       # Text import & extraction
│   └── api/            # LLM & image generation endpoints
├── components/         # React UI organized by feature
├── lib/                # Core logic (AI, state, algorithms)
├── types/              # TypeScript domain model
└── data/               # Seed narratives (demo stories)
```

## How It Works

1. **Create a narrative** — Use the creation wizard or import existing text
2. **Build your world** — Add characters, locations, and plot threads
3. **Generate scenes** — AI creates structured scenes with mutations tracking how characters, knowledge, and relationships change
4. **Plan beats** — Generate beat-by-beat scene blueprints
5. **Write prose** — AI writes full prose following the plan
6. **Grade & rewrite** — Score prose quality, then rewrite guided by the critique or your own analysis
7. **Explore branches** — Fork timelines to try alternate story directions
8. **Export** — Generate EPUB when your story is complete

## License

Private
