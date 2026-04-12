import type { NarrativeState, NarrativeViewState, AnalysisJob, ApiLogEntry, SystemLogEntry, SearchQuery } from '@/types/narrative';
import { idbGet, idbPut, idbDelete, idbGetAll, NARRATIVES_STORE, META_STORE, API_LOGS_STORE } from '@/lib/idb';
import { logInfo, logError } from '@/lib/system-logger';

const ACTIVE_KEY = 'activeNarrativeId';
const ACTIVE_BRANCH_KEY = 'activeBranchId';
const LS_STORAGE_KEY = 'narrative-engine:narratives';

// ── Narratives ───────────────────────────────────────────────────────────────

export async function loadNarratives(): Promise<NarrativeState[]> {
  if (typeof window === 'undefined') return [];
  try {
    return await idbGetAll<NarrativeState>(NARRATIVES_STORE);
  } catch (err) {
    throw new Error(`Failed to load narratives: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function saveNarrative(narrative: NarrativeState): Promise<void> {
  try {
    await idbPut(NARRATIVES_STORE, narrative.id, narrative);
  } catch (err) {
    throw new Error(`Failed to save narrative "${narrative.id}": ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function deleteNarrative(id: string): Promise<void> {
  try {
    await idbDelete(NARRATIVES_STORE, id);
  } catch (err) {
    // Errors logged at caller level
  }
}

export async function loadNarrative(id: string): Promise<NarrativeState | null> {
  try {
    const n = await idbGet<NarrativeState>(NARRATIVES_STORE, id);
    return n ?? null;
  } catch (err) {
    return null;
  }
}

// ── Active narrative ID ──────────────────────────────────────────────────────

export async function saveActiveNarrativeId(id: string | null): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      await idbPut(META_STORE, ACTIVE_KEY, id);
    } else {
      await idbDelete(META_STORE, ACTIVE_KEY);
    }
  } catch (err) {
    // Errors logged at caller level
  }
}

export async function loadActiveNarrativeId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const id = await idbGet<string>(META_STORE, ACTIVE_KEY);
    return id ?? null;
  } catch (err) {
    return null;
  }
}

// ── Active branch ID ─────────────────────────────────────────────────────────

export async function saveActiveBranchId(id: string | null): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      await idbPut(META_STORE, ACTIVE_BRANCH_KEY, id);
    } else {
      await idbDelete(META_STORE, ACTIVE_BRANCH_KEY);
    }
  } catch (err) {
    // Errors logged at caller level
  }
}

export async function loadActiveBranchId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const id = await idbGet<string>(META_STORE, ACTIVE_BRANCH_KEY);
    return id ?? null;
  } catch (err) {
    return null;
  }
}

// ── Analysis Jobs ────────────────────────────────────────────────────────────

const ANALYSIS_JOBS_KEY = 'analysisJobs';

export async function loadAnalysisJobs(): Promise<AnalysisJob[]> {
  if (typeof window === 'undefined') return [];
  try {
    const jobs = await idbGet<AnalysisJob[]>(META_STORE, ANALYSIS_JOBS_KEY);
    return jobs ?? [];
  } catch (err) {
    return [];
  }
}

export async function saveAnalysisJobs(jobs: AnalysisJob[]): Promise<void> {
  try {
    await idbPut(META_STORE, ANALYSIS_JOBS_KEY, jobs);
  } catch (err) {
    // Errors logged at caller level
  }
}

// ── API Logs (per narrative) ─────────────────────────────────────────────────

/** Load all API logs for a given narrative */
export async function loadApiLogs(narrativeId: string): Promise<ApiLogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const logs = await idbGet<ApiLogEntry[]>(API_LOGS_STORE, narrativeId);
    return logs ?? [];
  } catch (err) {
    return [];
  }
}

/** Save all API logs for a given narrative */
export async function saveApiLogs(narrativeId: string, logs: ApiLogEntry[]): Promise<void> {
  try {
    await idbPut(API_LOGS_STORE, narrativeId, logs);
  } catch (err) {
    // Errors logged at caller level
  }
}

/** Delete API logs for a narrative (used when deleting a narrative) */
export async function deleteApiLogs(narrativeId: string): Promise<void> {
  try {
    await idbDelete(API_LOGS_STORE, narrativeId);
  } catch (err) {
    // Errors logged at caller level
  }
}

// ── API Logs (per analysis job) ───────────────────────────────────────────────

function analysisLogsKey(analysisId: string): string {
  return `analysis:${analysisId}`;
}

/** Load all API logs for a given analysis job */
export async function loadAnalysisApiLogs(analysisId: string): Promise<ApiLogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const logs = await idbGet<ApiLogEntry[]>(API_LOGS_STORE, analysisLogsKey(analysisId));
    return logs ?? [];
  } catch (err) {
    return [];
  }
}

/** Save all API logs for a given analysis job */
export async function saveAnalysisApiLogs(analysisId: string, logs: ApiLogEntry[]): Promise<void> {
  try {
    await idbPut(API_LOGS_STORE, analysisLogsKey(analysisId), logs);
  } catch (err) {
    // Errors logged at caller level
  }
}

/** Delete API logs for an analysis job (used when deleting an analysis job) */
export async function deleteAnalysisApiLogs(analysisId: string): Promise<void> {
  try {
    await idbDelete(API_LOGS_STORE, analysisLogsKey(analysisId));
  } catch (err) {
    // Errors logged at caller level
  }
}

// ── System Logs (per narrative) ───────────────────────────────────────────────

function systemLogsKey(narrativeId: string): string {
  return `system:${narrativeId}`;
}

/** Load all system logs for a given narrative */
export async function loadSystemLogs(narrativeId: string): Promise<SystemLogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const logs = await idbGet<SystemLogEntry[]>(API_LOGS_STORE, systemLogsKey(narrativeId));
    return logs ?? [];
  } catch (err) {
    return [];
  }
}

/** Save all system logs for a given narrative */
export async function saveSystemLogs(narrativeId: string, logs: SystemLogEntry[]): Promise<void> {
  try {
    await idbPut(API_LOGS_STORE, systemLogsKey(narrativeId), logs);
  } catch (err) {
    // Errors logged at caller level
  }
}

/** Delete system logs for a narrative (used when deleting a narrative) */
export async function deleteSystemLogs(narrativeId: string): Promise<void> {
  try {
    await idbDelete(API_LOGS_STORE, systemLogsKey(narrativeId));
  } catch (err) {
    // Errors logged at caller level
  }
}

// ── System Logs (per analysis job) ────────────────────────────────────────────

function analysisSystemLogsKey(analysisId: string): string {
  return `system-analysis:${analysisId}`;
}

/** Load all system logs for a given analysis job */
export async function loadAnalysisSystemLogs(analysisId: string): Promise<SystemLogEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const logs = await idbGet<SystemLogEntry[]>(API_LOGS_STORE, analysisSystemLogsKey(analysisId));
    return logs ?? [];
  } catch (err) {
    return [];
  }
}

/** Save all system logs for a given analysis job */
export async function saveAnalysisSystemLogs(analysisId: string, logs: SystemLogEntry[]): Promise<void> {
  try {
    await idbPut(API_LOGS_STORE, analysisSystemLogsKey(analysisId), logs);
  } catch (err) {
    // Errors logged at caller level
  }
}

/** Delete system logs for an analysis job */
export async function deleteAnalysisSystemLogs(analysisId: string): Promise<void> {
  try {
    await idbDelete(API_LOGS_STORE, analysisSystemLogsKey(analysisId));
  } catch (err) {
    // Errors logged at caller level
  }
}

// ── Migration: localStorage → IndexedDB ──────────────────────────────────────

/**
 * One-time migration: move narratives from localStorage to IndexedDB.
 * After migration, clears the old localStorage key.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const raw = localStorage.getItem(LS_STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(LS_STORAGE_KEY);
      return;
    }

    logInfo(`Migrating ${parsed.length} narrative(s) from localStorage to IndexedDB`, {
      source: 'other',
      operation: 'migrate-storage',
      details: { narrativeCount: parsed.length }
    });

    for (const narrative of parsed as NarrativeState[]) {
      await idbPut(NARRATIVES_STORE, narrative.id, narrative);
    }

    // Migrate active narrative ID
    const activeId = localStorage.getItem('narrative-engine:activeNarrativeId');
    if (activeId) {
      await idbPut(META_STORE, ACTIVE_KEY, activeId);
      localStorage.removeItem('narrative-engine:activeNarrativeId');
    }

    localStorage.removeItem(LS_STORAGE_KEY);
    logInfo('Migration complete — localStorage cleared', {
      source: 'other',
      operation: 'migrate-storage',
      details: { narrativeCount: parsed.length }
    });
  } catch (err) {
    logError('Migration failed — localStorage data preserved', err, {
      source: 'other',
      operation: 'migrate-storage'
    });
  }
}

// ── Search State ─────────────────────────────────────────────────────────────

function getSearchStateKey(narrativeId: string): string {
  return `search:${narrativeId}`;
}

export async function saveSearchState(narrativeId: string, query: SearchQuery | null): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbPut(META_STORE, getSearchStateKey(narrativeId), query);
  } catch (err) {
    // Silently fail for search state persistence
  }
}

export async function loadSearchState(narrativeId: string): Promise<SearchQuery | null> {
  if (typeof window === 'undefined') return null;
  try {
    return (await idbGet<SearchQuery | null>(META_STORE, getSearchStateKey(narrativeId))) ?? null;
  } catch (err) {
    return null;
  }
}

// ── View State (per narrative) ───────────────────────────────────────────────

function getViewStateKey(narrativeId: string): string {
  return `viewState:${narrativeId}`;
}

export async function saveViewState(narrativeId: string, viewState: NarrativeViewState): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbPut(META_STORE, getViewStateKey(narrativeId), viewState);
  } catch (err) {
    // Silently fail for view state persistence
  }
}

export async function loadViewState(narrativeId: string): Promise<NarrativeViewState | null> {
  if (typeof window === 'undefined') return null;
  try {
    return (await idbGet<NarrativeViewState | null>(META_STORE, getViewStateKey(narrativeId))) ?? null;
  } catch (err) {
    return null;
  }
}

export async function deleteViewState(narrativeId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await idbDelete(META_STORE, getViewStateKey(narrativeId));
  } catch (err) {
    // Silently fail
  }
}
