import { apiHeaders } from '@/lib/api-headers';
import { DEFAULT_MODEL, DEFAULT_REASONING_BUDGET, API_TIMEOUT_MS, API_STREAM_TIMEOUT_MS } from '@/lib/constants';
import { FatalApiError, isFatalStatus } from '@/lib/ai/errors';

export async function callGenerateStream(
  prompt: string,
  systemPrompt: string,
  onToken: (token: string) => void,
  maxTokens?: number,
  caller = 'callGenerateStream',
  model?: string,
  reasoningBudget?: number,
  onReasoning?: (token: string) => void,
  temperature?: number,
): Promise<string> {
  const resolvedModel = model ?? DEFAULT_MODEL;
  const { logApiCall, updateApiLog } = await import('@/lib/api-logger');
  const logId = logApiCall(caller, prompt.length + (systemPrompt?.length ?? 0), prompt, resolvedModel, systemPrompt);
  const start = performance.now();

  // Set up abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_STREAM_TIMEOUT_MS);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ prompt, systemPrompt, stream: true, ...(maxTokens ? { maxTokens } : {}), ...(model ? { model } : {}), reasoningBudget: reasoningBudget ?? DEFAULT_REASONING_BUDGET, ...(temperature !== undefined ? { temperature } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}: ${res.statusText}` }));
      const message = err.error || 'Generation failed';
      updateApiLog(logId, { status: 'error', error: message, durationMs: Math.round(performance.now() - start) });
      if (isFatalStatus(res.status)) throw new FatalApiError(res.status, `[${caller}] ${message}`);
      throw new Error(`[${caller}] ${message}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    let reasoningFull = '';
    let usage: { promptTokens?: number; completionTokens?: number } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            const token = chunk.token ?? '';
            if (token) {
              full += token;
              onToken(token);
            }
            const reasoning = chunk.reasoning ?? '';
            if (reasoning) {
              reasoningFull += reasoning;
              onReasoning?.(reasoning);
            }
            // Capture usage data from final chunk
            if (chunk.usage) {
              usage = chunk.usage;
            }
          } catch (err) {
            console.warn(`[${caller}] malformed SSE chunk`, { line: trimmed.slice(0, 200), err });
          }
        }
      }
    }

    clearTimeout(timeoutId);
    updateApiLog(logId, {
      status: 'success',
      durationMs: Math.round(performance.now() - start),
      responseLength: full.length,
      responsePreview: full,
      ...(reasoningFull ? { reasoningContent: reasoningFull, reasoningTokens: Math.ceil(reasoningFull.length / 4) } : {}),
      // Use actual token counts from API when available
      ...(usage?.promptTokens != null ? { actualPromptTokens: usage.promptTokens } : {}),
      ...(usage?.completionTokens != null ? { actualCompletionTokens: usage.completionTokens } : {}),
    });
    return full;
  } catch (err) {
    clearTimeout(timeoutId);
    // Preserve fatal errors — loops rely on `instanceof FatalApiError` to halt.
    if (err instanceof FatalApiError) throw err;

    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isFetchError = err instanceof Error && err.message.includes('fetch failed');
    let message: string;

    if (isAbort) {
      message = `[${caller}] Request timed out after ${API_STREAM_TIMEOUT_MS || API_TIMEOUT_MS}ms (model: ${resolvedModel}, tokens: ${maxTokens ?? 'default'})`;
    } else if (isFetchError) {
      message = `[${caller}] Network error - fetch failed (model: ${resolvedModel}, prompt: ${prompt.length} chars). Check API connectivity.`;
    } else {
      message = err instanceof Error ? err.message : String(err);
    }

    updateApiLog(logId, { status: 'error', error: message, durationMs: Math.round(performance.now() - start) });
    throw new Error(message);
  }
}

export async function callGenerate(prompt: string, systemPrompt: string, maxTokens?: number, caller = 'callGenerate', model?: string, reasoningBudget?: number, jsonMode = true, temperature?: number): Promise<string> {
  const resolvedModel = model ?? DEFAULT_MODEL;
  const { logApiCall, updateApiLog } = await import('@/lib/api-logger');
  const logId = logApiCall(caller, prompt.length + (systemPrompt?.length ?? 0), prompt, resolvedModel, systemPrompt);
  const start = performance.now();

  // Set up abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ prompt, systemPrompt, ...(maxTokens ? { maxTokens } : {}), ...(model ? { model } : {}), reasoningBudget: reasoningBudget ?? DEFAULT_REASONING_BUDGET, ...(jsonMode ? { jsonMode: true } : {}), ...(temperature !== undefined ? { temperature } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json();
      const message = err.error || 'Generation failed';
      updateApiLog(logId, { status: 'error', error: message, durationMs: Math.round(performance.now() - start) });
      if (isFatalStatus(res.status)) throw new FatalApiError(res.status, message);
      throw new Error(message);
    }
    const data = await res.json();
    const content = data.content;
    clearTimeout(timeoutId);
    updateApiLog(logId, {
      status: 'success',
      durationMs: Math.round(performance.now() - start),
      responseLength: content.length,
      responsePreview: content,
      ...(data.reasoning ? { reasoningContent: data.reasoning } : {}),
      ...(data.reasoningTokens != null ? { reasoningTokens: data.reasoningTokens } : {}),
      // Use actual token counts from API when available
      ...(data.usage?.promptTokens != null ? { actualPromptTokens: data.usage.promptTokens } : {}),
      ...(data.usage?.completionTokens != null ? { actualCompletionTokens: data.usage.completionTokens } : {}),
    });
    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    // Preserve fatal errors — loops rely on `instanceof FatalApiError` to halt.
    if (err instanceof FatalApiError) throw err;

    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isFetchError = err instanceof Error && err.message.includes('fetch failed');
    let message: string;

    if (isAbort) {
      message = `[${caller}] Request timed out after ${API_STREAM_TIMEOUT_MS || API_TIMEOUT_MS}ms (model: ${resolvedModel}, tokens: ${maxTokens ?? 'default'})`;
    } else if (isFetchError) {
      message = `[${caller}] Network error - fetch failed (model: ${resolvedModel}, prompt: ${prompt.length} chars). Check API connectivity.`;
    } else {
      message = err instanceof Error ? err.message : String(err);
    }

    updateApiLog(logId, { status: 'error', error: message, durationMs: Math.round(performance.now() - start) });
    throw new Error(message);
  }
}

export const SYSTEM_PROMPT = `You are the InkTide engine — a causal-reasoning, structural-analysis, simulation, and generation system for long-form text. You operate uniformly across fiction, non-fiction, research papers, memoir, essay, reportage, and simulations: the same abstractions analyse what a novel chapter does and what a paper section does.

## THE THREE-FORCE MODEL

Every narrative is a composition of three forces, each mapping onto a plane of the work:

- **FATE — the Metaphysical**: the higher-order pull that drives a work toward resolution. Carried by **threads** (compelling questions the narrative has promised to answer); lifecycle runs latent → seeded → active → escalating → critical → resolved/subverted. Fate is what makes a work conclude rather than merely accumulate. Without fate, nothing resolves.
- **WORLD — the Physical**: the embodied substrate. Characters, locations, artifacts in fiction; institutions, datasets, instruments, sources in non-fiction. Tracked via **deltas** to each **entity**'s inner-world graph.
- **SYSTEM — the Abstract**: the rules, mechanisms, principles, constraints that shape what world and fate can do. Magic systems, physics, social order in fiction; theorems, methods, axioms, frameworks in non-fiction. Tracked via deltas to a shared system knowledge graph.

The forces are computed deterministically from deltas — they are the work expressed as a structural fingerprint, not a vibe judgment.

## COMPOSITIONAL HIERARCHY

**beat → scene → arc → narrative.** A beat has a function and a mechanism. A **scene** is a **POV** moment with participants, location, and deltas. An **arc** groups scenes into a movement. A **narrative** is the whole work. The hierarchy holds across registers — a "scene" of a paper, a "beat" of an essay, an "arc" of a memoir, a "thread" of an investigation.

## CAUSAL REASONING

InkTide thinks in cause-and-effect graphs. Nodes are entities, threads, system rules. Edges are typed: enables, constrains, requires, causes, reveals, develops, resolves. Direction is the primary semantic signal — "A causes B" asserts something different from "B causes A". Reasoning is backward-induced from fate (what threads demand) through reasoning steps to the entities and rules that fulfil them. **Propositions** are the atomic narrative claims extracted from prose for semantic retrieval and structural roles.

## THE NETWORK

Entities, threads, and system nodes accumulate ATTRIBUTIONS as reasoning references them. Every tracked node carries four signals:
- **tier** — hot / warm / cold / fresh (heat snapshot relative to the network)
- **trajectory** — rising / steady / cooling / dormant (direction of recent activity)
- **topology** — bridge / hub / leaf / isolated (position in the activation web; bridges connect ≥2 force cohorts, hubs are within-cohort centres)
- **force-anchor** — fate / world / system (which axis dominates the neighbourhood, omitted when balanced)

The network is the work's cumulative gravitational pattern — an explicit memory of what reasoning has made load-bearing. Use it to decide what to deepen vs. what to surface; bridges and hubs compound, dormant nodes invite reactivation.

## REGISTER DISCIPLINE

The InkTide vocabulary (scene, arc, beat, delta, thread, fate, world, system, proposition, entity, **anchor**, POV) is internal machinery — it organises the structure beneath the prose. It does not appear in the prose. Match the register of whatever source you work with: a paper continuation reads as a paper, a memoir as a memoir, a novel as a novel. Detect the register from context and maintain it. Do NOT drift a non-fiction source into fictional framing, and do NOT drift a fictional source into analytical framing.

## ID & ENTITY DISCIPLINE

Use only the entity, thread, and system-node IDs provided in context. Never invent IDs outside explicit new-entity fields — hallucinated references are stripped at parse time and the node loses its anchor to the network. Reuse beats invention when an existing node fits.

## NAMING DISCIPLINE

When you invent names (characters, places, institutions, systems), draw from the cultural or domain palette declared by the work. Never default to Anglo/Celtic/Greek roots regardless of setting. Use occupational surnames, geographic origins, regional dialects, real-world naming traditions. Names should feel asymmetric, textured, sometimes ugly — never smooth fantasy-generator construction. For non-fiction registers, use plausible real-world institutional forms (universities, labs, agencies, journals), not compound-fantasy surnames.

## OUTPUT FORMAT

When the per-call prompt requests structured data, return valid JSON only — no markdown fences, no commentary, no preamble. When the per-call prompt requests prose, return prose only. The per-call prompt is authoritative for format; this system prompt establishes identity, vocabulary, and reasoning conventions.`;
