"use client";

import { API_LOG_STALE_THRESHOLD_MS } from "@/lib/constants";
import type { ApiLogEntry, SystemLogEntry } from "@/types/narrative";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

// Maximum log entries to keep in memory (prevents unbounded growth)
const MAX_LOG_ENTRIES = 500;

// ── State ────────────────────────────────────────────────────────────────────

type LogsState = {
  apiLogs: ApiLogEntry[];
  systemLogs: SystemLogEntry[];
};

const initialState: LogsState = {
  apiLogs: [],
  systemLogs: [],
};

// ── Actions ──────────────────────────────────────────────────────────────────

type LogsAction =
  | { type: "LOG_API_CALL"; entry: ApiLogEntry }
  | { type: "UPDATE_API_LOG"; id: string; updates: Partial<ApiLogEntry> }
  | { type: "CLEAR_API_LOGS" }
  | { type: "LOG_SYSTEM"; entry: SystemLogEntry }
  | { type: "CLEAR_SYSTEM_LOGS" };

// ── Reducer ──────────────────────────────────────────────────────────────────

function logsReducer(state: LogsState, action: LogsAction): LogsState {
  switch (action.type) {
    case "LOG_API_CALL": {
      const newLogs = [...state.apiLogs, action.entry];
      // Prune oldest entries if exceeding limit
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return { ...state, apiLogs: newLogs.slice(-MAX_LOG_ENTRIES) };
      }
      return { ...state, apiLogs: newLogs };
    }

    case "UPDATE_API_LOG":
      return {
        ...state,
        apiLogs: state.apiLogs.map((l) =>
          l.id === action.id ? { ...l, ...action.updates } : l
        ),
      };

    case "CLEAR_API_LOGS":
      return { ...state, apiLogs: [] };

    case "LOG_SYSTEM": {
      const newLogs = [...state.systemLogs, action.entry];
      // Prune oldest entries if exceeding limit
      if (newLogs.length > MAX_LOG_ENTRIES) {
        return { ...state, systemLogs: newLogs.slice(-MAX_LOG_ENTRIES) };
      }
      return { ...state, systemLogs: newLogs };
    }

    case "CLEAR_SYSTEM_LOGS":
      return { ...state, systemLogs: [] };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

type LogsContextType = {
  state: LogsState;
  dispatch: React.Dispatch<LogsAction>;
};

const LogsContext = createContext<LogsContextType | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function LogsProvider({
  children,
  activeNarrativeId,
}: {
  children: ReactNode;
  activeNarrativeId: string | null;
}) {
  const [state, dispatch] = useReducer(logsReducer, initialState);
  const prevActiveIdRef = useRef<string | null>(null);

  // Wire API logger to this context
  useEffect(() => {
    import("@/lib/api-logger").then(({ onApiLog, onApiLogUpdate }) => {
      onApiLog((entry) => dispatch({ type: "LOG_API_CALL", entry }));
      onApiLogUpdate((id, updates) =>
        dispatch({ type: "UPDATE_API_LOG", id, updates })
      );
    });
  }, []);

  // Keep logger aware of which narrative is active
  useEffect(() => {
    import("@/lib/api-logger").then(({ setLoggerNarrativeId }) => {
      setLoggerNarrativeId(activeNarrativeId);
    });
  }, [activeNarrativeId]);

  // Wire system logger to this context
  useEffect(() => {
    import("@/lib/system-logger").then(({ onSystemLog }) => {
      onSystemLog((entry) => dispatch({ type: "LOG_SYSTEM", entry }));
    });
  }, []);

  // Keep system logger aware of which narrative is active
  useEffect(() => {
    import("@/lib/system-logger").then(({ setSystemLoggerNarrativeId }) => {
      setSystemLoggerNarrativeId(activeNarrativeId);
    });
  }, [activeNarrativeId]);

  // Stale log cleanup - mark pending API logs as error after threshold
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      state.apiLogs.forEach((log) => {
        if (
          log.status === "pending" &&
          now - log.timestamp > API_LOG_STALE_THRESHOLD_MS
        ) {
          dispatch({
            type: "UPDATE_API_LOG",
            id: log.id,
            updates: {
              status: "error",
              error: "Request timed out (marked stale)",
            },
          });
        }
      });
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [state.apiLogs]);

  return (
    <LogsContext.Provider value={{ state, dispatch }}>
      {children}
    </LogsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLogs() {
  const ctx = useContext(LogsContext);
  if (!ctx) {
    throw new Error("useLogs must be used within a LogsProvider");
  }
  return ctx;
}

// Re-export action helper for cleaner API
export function useLogsActions() {
  const { dispatch } = useLogs();

  return {
    clearApiLogs: useCallback(
      () => dispatch({ type: "CLEAR_API_LOGS" }),
      [dispatch]
    ),
    clearSystemLogs: useCallback(
      () => dispatch({ type: "CLEAR_SYSTEM_LOGS" }),
      [dispatch]
    ),
  };
}
