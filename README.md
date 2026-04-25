![InkTide](public/readme-banner.png)

# InkTide

**Narrative is a composition of three forces in flux.**

Every story is fate, world, and system — threads accumulating commitment toward resolution, entities transforming under pressure, rules deepening beneath the surface. InkTide makes these forces measurable. Paste any long-form text and it builds a living knowledge graph that evolves section by section, deriving the structural forces that shape the work. A Classic is fate-dominant. A Show is world-dominant. A Paper is system-dominant. An Opus balances all three.

Everything becomes searchable by meaning. Every proposition is embedded as a vector. Search for "sacrifice" and surface every moment of selfless choice across the timeline, even when the word never appears. Each analyzed work contributes its pacing fingerprint to a growing network of structural intelligence.

The same forces power generation — new content shaped by the rhythms of published works, branching paths explored via MCTS, and drafts refined through structural evaluation.

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

Three forces — the channels through which information reaches the reader. Rank→Gaussian normalised, derived from knowledge-graph mutations and prediction-market information gain. Pure math, no LLM:

| Force      | What it measures                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fate**   | `Σ_t v_t · D_KL(p⁺‖p⁻)` — attention-weighted Kullback–Leibler divergence across thread prediction markets. The narrator's belief moving under new evidence. |
| **World**  | `ΔN + √ΔE` — new facts added to entity continuity graphs (characters, locations, artifacts). |
| **System** | `ΔN + √ΔE` — new rules, concepts, and relations added to the world-mechanism graph. |

Each force is graded 0–25, 100 total (+ swing). The **narrative cube** maps force combinations into 8 modes — a vocabulary for how stories move through fate/world/system space.

The aggregate is the **information curve** `I = w_F·F + w_W·W + w_S·S`, with weights recovered by PCA on the three force trajectories — the work's own information signature. A paper weights system heavily, a character novel world-heavy, a thriller fate-heavy; mixed signatures are the default. Peaks = moments of rich information in the work's own vocabulary; valleys = information-light stretches that structurally set up the next delivery.

Additional layers: **swing** (the rhythm of contrast between sections), **pacing profiles** (Markov transition matrices capturing an author's structural signature), and **scale & density** (how richly interconnected the world becomes).

### Query

Every proposition, beat, and scene is embedded as a 1536-dimensional vector. Cosine similarity retrieves content by meaning, not keywords. AI-synthesized overviews trace thematic patterns across the full timeline with inline citations.

Applications: continuity validation (verifying that referenced events actually occurred), tracking what each character knows at any point in the story, and semantic retrieval that gives generation rich context from anywhere in the timeline.

### Interrogate

Forces and embeddings measure what's on the page. Four research instruments probe what's *carried* — the beliefs entities hold, the moves they make, the strategic structure beneath the prose, and how ELO ratings accumulate across a story.

| Method          | Shape                                                         | What it surfaces                                                                                                                                     |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Surveys**     | One question × N respondents — cast-wide distribution         | Fault-lines across the cast. Eight research lenses (Personality, Values, Knowledge, Trust, Allegiance, Threat, Predictions, Backstory) tilt the axis |
| **Interviews**  | One subject × N questions — single-mind depth profile         | Internal structure of one mind — self-image vs behaviour, tradeoff hierarchies, formative backstory, knowledge surface                               |
| **Game theory** | 2×2 game decomposition per strategic beat, additive per scene | The moves beneath the prose. 14 axes (disclosure, trust, confrontation, stakes...), 19 shapes (coordination, dilemma, stag-hunt, chicken...)         |
| **ELO ratings** | Continuous margin score drives per-player rating updates      | Who trends up, who collapses, and where the turning points land. Trajectories + behaviour tags (extractor, schemer, dominant, responder, steady)     |

Every entity answers surveys and interviews in-character from its own world-graph continuity — responses are grounded in what that specific entity actually knows, not in the LLM's general knowledge. Game-theoretic analysis is orthogonal to narrative structure (a scene can be force-balanced while containing an unresolved prisoner's dilemma); ELO turns those games into a running tally of strategic success that reveals story-wide power dynamics the prose alone never summarises.

### Reason

Generation is steered by **causal reasoning graphs** — 8–20 typed nodes per arc (fate, reasoning, character, location, artifact, system, pattern, warning, chaos) with typed edges (requires / enables / causes / resolves...). Scenes execute the graph; threads advance because an entity had to decide, not because the prompt said so.

Four **thinking modes** shape how the graph is built:

| Mode           | Direction           | Signature                                                                                     |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| **Abduction**  | Backward, selective | Committed outcome ← best hypothesis among competitors. *Default for narrative planning.*      |
| **Divergent**  | Forward, expansive  | One premise branches into many possibilities; leaves marked for pairwise compatibility.       |
| **Deduction**  | Forward, narrow     | Premise → necessary consequence chain. Rigid derivation, low branching factor.                |
| **Induction**  | Backward, general   | Many observations → inferred principle. Retains competing generalisations.                    |

The reasoning graph from the last arc is fed into the next generation with divergence pressure, so successive arcs differ in causal shape rather than re-describing the same spine with cosmetic variation.

### Generate

| Capability             | How it works                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Markov pacing**      | Learn the rhythm of any published work and write in its structural signature            |
| **Prose profiles**     | Beat plans shaped by authorial Markov chains — 10 functions, 8 mechanisms               |
| **MCTS search**        | Explore branching narrative paths, each guided by a fresh pacing sequence               |
| **Course correction**  | Direction adapts after each arc based on what the story actually became                 |
| **Iterative revision** | Evaluate → verdict (ok / edit / merge / insert / cut) → reconstruct into refined drafts |
| **Pacing presets**     | Curated arcs (Sucker Punch, Slow Burn, Roller Coaster) for targeted narrative shapes    |

---

## Architecture

```
Next.js 16 · React 19 · TypeScript · Tailwind v4 · D3.js
OpenRouter (DeepSeek v4 Flash) · OpenAI Embeddings · Replicate (Seedream 4.5)
IndexedDB + localStorage — fully client-side persistence, no backend database
```

All LLM calls route through OpenRouter. Embeddings use OpenAI's `text-embedding-3-small` (1536 dimensions). Image generation uses Replicate's Seedream 4.5. State is managed via React Context + useReducer with IndexedDB persistence.

See the **[paper](https://inktide-sourcenovel.vercel.app/paper)** for the full theory — force formulas, Markov chain pacing, MCTS evaluation, beat taxonomy, and validation against published works.

---

## License

MIT — see [LICENSE](LICENSE)
