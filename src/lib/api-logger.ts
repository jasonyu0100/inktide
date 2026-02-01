import type { ApiLogEntry } from '@/types/narrative';

type LogListener = (entry: ApiLogEntry) => void;
type UpdateListener = (id: string, updates: Partial<ApiLogEntry>) => void;

let logListener: LogListener | null = null;
let updateListener: UpdateListener | null = null;

let counter = 0;

export function onApiLog(listener: LogListener) {
  logListener = listener;
}

export function onApiLogUpdate(listener: UpdateListener) {
  updateListener = listener;
}

export function logApiCall(caller: string, promptLength: number, promptPreview: string): string {
  const id = `api-${Date.now()}-${counter++}`;
  const entry: ApiLogEntry = {
    id,
    timestamp: Date.now(),
    caller,
    status: 'pending',
    durationMs: null,
    promptLength,
    responseLength: null,
    error: null,
    promptPreview: promptPreview,
    responsePreview: null,
  };
  logListener?.(entry);
  return id;
}

export function updateApiLog(id: string, updates: Partial<ApiLogEntry>) {
  updateListener?.(id, updates);
}
