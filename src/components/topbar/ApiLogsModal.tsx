'use client';

import { useState } from 'react';
import { useLogs } from '@/lib/logs-context';
import { useStore } from '@/lib/store';
import { ApiLogsViewer } from '@/components/apilogs/ApiLogsViewer';

type LogFilter = 'all' | 'narrative' | 'analysis';

/**
 * Series-side API logs entry point. The actual viewer chrome (list,
 * detail tabs, cost display) lives in `ApiLogsViewer` so this modal
 * and the analysis-page modal share one implementation. This wrapper
 * just scopes the log set and supplies the filter dropdown.
 */
export function ApiLogsModal({ onClose }: { onClose: () => void }) {
  const { state: logsState, dispatch: logsDispatch } = useLogs();
  const { state: appState } = useStore();
  const [filter, setFilter] = useState<LogFilter>('all');

  const filteredLogs = logsState.apiLogs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'narrative') return log.narrativeId === appState.activeNarrativeId;
    if (filter === 'analysis') return log.analysisId != null;
    return true;
  });

  const pendingCount = filteredLogs.filter((l) => l.status === 'pending').length;
  const errorCount = filteredLogs.filter((l) => l.status === 'error').length;

  return (
    <ApiLogsViewer
      onClose={onClose}
      logs={filteredLogs}
      title="API Logs"
      headerActions={
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogFilter)}
            className="bg-white/5 border border-white/10 text-text-primary text-[11px] px-2 py-1 rounded hover:bg-white/8 transition-colors"
          >
            <option value="all">All</option>
            <option value="narrative">Narrative</option>
            <option value="analysis">Analysis</option>
          </select>
          {pendingCount > 0 && <span className="text-[10px] text-amber-400">{pendingCount} pending</span>}
          {errorCount > 0 && <span className="text-[10px] text-red-400">{errorCount} failed</span>}
        </div>
      }
      emptyMessage={filter === 'all' ? 'No API calls yet. Generate or expand to see logs.' : `No ${filter} API calls.`}
      onClear={() => logsDispatch({ type: 'CLEAR_API_LOGS' })}
    />
  );
}
