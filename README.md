![InkTide](public/readme-banner.png)

# InkTide

**Knowledge-graph-based text analysis, querying, and generation engine.**

Paste any long-form text — a novel, a paper, a screenplay — and InkTide builds a living knowledge graph that evolves section by section. Multiple analysis layers reveal the structural forces shaping the narrative: how threads resolve, how characters transform, how the world deepens, and how the rhythm breathes. Applied to Harry Potter, the system surfaces the Sorting Hat, the troll fight, and the Quirrell confrontation as structural peaks — discovered, not labeled.

Everything becomes searchable by meaning. Every proposition is embedded as a vector. Search for "sacrifice" and surface every moment of selfless choice across the timeline, even when the word never appears. Each analyzed work contributes its pacing fingerprint to a growing network of structural intelligence.

The same analysis layers power generation — new content shaped by the rhythms of published works, branching paths explored via MCTS, and drafts refined through structural evaluation.

**[Read the paper →](https://inktide-sourcenovel.vercel.app/paper)** · **[Case analysis →](https://inktide-sourcenovel.vercel.app/case-analysis)** · **[Try it →](https://inktide-sourcenovel.vercel.app/)**

---

## Quick Start

```bash
git clone https://github.com/jasonyu0100/inktide.git
cd inktide
npm install
cp .env.example .env.local   # add your OpenRouter key
npm run dev                   # → http://localhost:3001
```

You need an **[OpenRouter API key](https://openrouter.ai/keys)** for LLM access. Optionally add a **Replicate token** for image generation. See `.env.example` for all options.

---

## What It Does

### Analyze

Three force dimensions, all z-score normalised, computed from knowledge graph evolution — pure math, no LLM:

| Force | What it reveals |
|-------|-----------------|
| **Payoff** | Thread resolution — promises kept, tensions released, turning points that reshape the story |
| **Change** | Transformation depth — how characters grow, relationships shift, and the familiar becomes new |
| **Knowledge** | World enrichment — new concepts, systems, and connections that expand what's possible |

Each force is graded 0–25 on an exponential curve, 100 total. The **narrative cube** maps force combinations into 8 modes (Epoch, Climax, Revelation, Closure, Discovery, Growth, Lore, Rest) — a vocabulary for how stories move.

Additional layers: **swing** (the rhythm of contrast between sections), **pacing profiles** (Markov transition matrices capturing an author's structural signature), and **scale & density** (how richly interconnected the world becomes).

### Query

Every proposition, beat, and scene is embedded as a 1536-dimensional vector. Cosine similarity retrieves content by meaning, not keywords. AI-synthesized overviews trace thematic patterns across the full timeline with inline citations.

Applications: continuity validation (verifying that referenced events actually occurred), tracking what each character knows at any point in the story, and semantic retrieval that gives generation rich context from anywhere in the timeline.

### Generate

| Capability | How it works |
|-----------|-------------|
| **Markov pacing** | Learn the rhythm of any published work and write in its structural signature |
| **Prose profiles** | Beat plans shaped by authorial Markov chains — 10 functions, 8 mechanisms |
| **MCTS search** | Explore branching narrative paths, each guided by a fresh pacing sequence |
| **Course correction** | Direction adapts after each arc based on what the story actually became |
| **Iterative revision** | Evaluate → verdict (ok / edit / merge / insert / cut) → reconstruct into refined drafts |
| **Pacing presets** | Curated arcs (Sucker Punch, Slow Burn, Roller Coaster) for targeted narrative shapes |

---

## Architecture

```
Next.js 16 · React 19 · TypeScript · Tailwind v4 · D3.js
OpenRouter (Gemini 2.5/3 Flash) · OpenAI Embeddings · Replicate (Seedream 4.5)
IndexedDB + localStorage — fully client-side persistence, no backend database
```

All LLM calls route through OpenRouter. Embeddings use OpenAI's `text-embedding-3-small` (1536 dimensions). Image generation uses Replicate's Seedream 4.5. State is managed via React Context + useReducer with IndexedDB persistence.

See the **[paper](https://inktide-sourcenovel.vercel.app/paper)** for the full theory — force formulas, Markov chain pacing, MCTS evaluation, beat taxonomy, and validation against published works.

---

## License

MIT — see [LICENSE](LICENSE)
