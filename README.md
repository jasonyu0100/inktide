![InkTide](public/readme-banner.png)

# InkTide

**Knowledge-graph-based text analysis, querying, and generation engine.**

Paste any long-form text — a novel, a paper, a screenplay — and InkTide builds a knowledge graph that mutates section by section. Multiple analysis layers score the structural forces at work: thread resolution, transformation intensity, new information, pacing rhythm, and dynamic contrast. Applied to Harry Potter, the system identifies the Sorting Hat, the troll fight, and the Quirrell confrontation as structural peaks — without human labeling.

Everything becomes searchable by meaning. Every proposition is embedded as a vector. Ask about "betrayal" and find scenes of broken trust even when the word never appears. Each analyzed work adds its pacing fingerprint to a growing network of structural data.

The same analysis layers drive generation — content paced by Markov chains from published works, branching paths explored via MCTS, and iterative revision through structural evaluation.

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

Three force dimensions, all z-score normalised, computed deterministically from knowledge graph mutations — no LLM in the scoring loop:

| Force | What it measures |
|-------|-----------------|
| **Payoff** | Thread phase transitions — the moments the text can't take back |
| **Change** | How intensely subjects were transformed — continuity mutations, relationship shifts |
| **Knowledge** | How much richer the world became — new concepts, systems, connections |

Each force is graded 0–25 on an exponential curve, 100 total. The **narrative cube** maps force combinations into 8 modes (Epoch, Climax, Revelation, Closure, Discovery, Growth, Lore, Rest) used for pacing analysis, Markov chain sampling, and MCTS search.

Additional layers: **swing** (dynamic contrast between consecutive sections), **pacing profiles** (Markov transition matrices over scene modes and beat functions), and **scale & density** (world knowledge interconnection depth).

### Query

Every proposition, beat, and scene is embedded as a 1536-dimensional vector. Cosine similarity retrieves content by meaning, not keywords. AI-synthesized overviews trace patterns across the full timeline with inline citations.

Applications: continuity validation (does the referenced event actually exist?), knowledge asymmetry tracking (does this character actually know this?), semantic retrieval for generation context.

### Generate

| Capability | How it works |
|-----------|-------------|
| **Markov pacing** | Transition matrices from analyzed works shape scene-by-scene rhythm |
| **Prose profiles** | Beat plans with authorial Markov chains over a 10-function / 8-mechanism taxonomy |
| **MCTS search** | Explores branching narrative paths, each expansion guided by a fresh pacing sequence |
| **Course correction** | Direction vectors rewritten after each arc based on what actually happened |
| **Iterative revision** | Evaluate → verdict (ok / edit / merge / insert / cut) → reconstruct versioned branches |
| **Pacing presets** | Curated sequences (Sucker Punch, Slow Burn, Roller Coaster, etc.) that bypass Markov sampling |

---

## Architecture

```
Next.js 16 · React 19 · TypeScript · Tailwind v4 · D3.js
OpenRouter (Gemini 2.5/3 Flash) · OpenAI Embeddings · Replicate (Seedream 4.5)
IndexedDB + localStorage — fully client-side persistence, no backend database
```

All LLM calls route through OpenRouter. Embeddings use OpenAI's `text-embedding-3-small` (1536 dimensions). Image generation uses Replicate's Seedream 4.5. State is managed via React Context + useReducer with IndexedDB persistence.

See the **[paper](https://inktide-sourcenovel.vercel.app/paper)** for the full formal treatment — force formulas, Markov chain pacing, MCTS evaluation, beat taxonomy, and validation against published works.

---

## License

MIT — see [LICENSE](LICENSE)
