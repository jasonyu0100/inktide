'use client';

import type { SlidesData } from '@/lib/slides-data';

// Progressive color scale: cool → warm as intensity rises
const STATUS_COLORS: Record<string, string> = {
  dormant:   '#475569',
  active:    '#38BDF8',
  escalating:'#FBBF24',
  critical:  '#F87171',
  resolved:  '#34D399',
  subverted: '#C084FC',
  abandoned: '#64748B',
};

type Transition = { sceneIdx: number; from: string; to: string };
type Segment = { start: number; end: number; status: string };

export function ThreadLifecycleSlide({ data }: { data: SlidesData }) {
  const ranked = [...data.threadLifecycles]
    .map((thread) => {
      const transitions: Transition[] = [];
      const pulseScenes: number[] = [];

      for (let i = 1; i < thread.statuses.length; i++) {
        if (thread.statuses[i].status !== thread.statuses[i - 1].status) {
          transitions.push({
            sceneIdx: thread.statuses[i].sceneIdx,
            from: thread.statuses[i - 1].status,
            to: thread.statuses[i].status,
          });
        }
      }

      for (let i = 0; i < data.scenes.length; i++) {
        for (const tm of data.scenes[i].threadMutations) {
          if (tm.threadId === thread.threadId && tm.from === tm.to) {
            pulseScenes.push(i);
          }
        }
      }

      const segments: Segment[] = [];
      let currentStatus = '';
      let segStart = 0;
      const firstScene = thread.statuses[0]?.sceneIdx ?? 0;
      const lastScene = thread.statuses[thread.statuses.length - 1]?.sceneIdx ?? 0;

      for (const s of thread.statuses) {
        if (s.status !== currentStatus) {
          if (currentStatus) {
            segments.push({ start: segStart, end: s.sceneIdx - 1, status: currentStatus });
          }
          currentStatus = s.status;
          segStart = s.sceneIdx;
        }
      }
      if (currentStatus) {
        segments.push({ start: segStart, end: lastScene, status: currentStatus });
      }

      const endStatus = thread.statuses[thread.statuses.length - 1]?.status ?? 'dormant';

      return { thread, transitions, pulseScenes, segments, endStatus, firstScene, lastScene };
    })
    .sort((a, b) => b.transitions.length - a.transitions.length)
    .slice(0, 10);

  return (
    <div className="flex flex-col h-full px-12 py-8 justify-center">
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-2xl font-bold text-text-primary">Thread Lifecycle</h2>
        <span className="text-xs text-text-dim font-mono">Top {ranked.length} by transitions</span>
      </div>
      <p className="text-xs text-text-dim mb-5">
        Each thread&apos;s lifecycle from first to last mention. Bright lines mark phase transitions, subtle ticks show pulses.
      </p>

      <div className="overflow-y-auto">
        <div className="space-y-1">
          {ranked.map(({ thread, transitions, pulseScenes, segments, endStatus, firstScene, lastScene }) => {
            const range = Math.max(lastScene - firstScene, 1);
            const toPercent = (sceneIdx: number) => ((sceneIdx - firstScene) / range) * 100;

            return (
              <div key={thread.threadId} className="py-1.5">
                {/* Row: description left, status right */}
                <div className="flex items-baseline justify-between mb-1 gap-4">
                  <p className="text-[11px] text-text-secondary leading-snug flex-1">
                    {thread.description}
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="text-[10px] font-mono capitalize font-semibold"
                      style={{ color: STATUS_COLORS[endStatus] ?? '#475569' }}
                    >
                      {endStatus}
                    </span>
                    <span className="text-[9px] text-text-dim font-mono">
                      ({transitions.length})
                    </span>
                    <span className="text-[9px] text-text-dim font-mono ml-1">
                      {firstScene + 1}–{lastScene + 1}
                    </span>
                  </div>
                </div>

                {/* Timeline bar */}
                <div className="h-4 rounded-sm bg-white/3 relative">
                  {/* Status segments */}
                  {segments.map((seg, i) => {
                    const left = toPercent(seg.start);
                    const width = toPercent(seg.end + 1) - left;
                    return (
                      <div
                        key={`seg-${i}`}
                        className="absolute top-0 h-full"
                        style={{
                          left: `${left}%`,
                          width: `${Math.max(width, 0.4)}%`,
                          backgroundColor: STATUS_COLORS[seg.status] ?? '#475569',
                          opacity: 0.4,
                        }}
                        title={`${seg.status} (scenes ${seg.start + 1}–${seg.end + 1})`}
                      />
                    );
                  })}

                  {/* Pulse ticks */}
                  {pulseScenes.map((sceneIdx, i) => {
                    if (sceneIdx < firstScene || sceneIdx > lastScene) return null;
                    return (
                      <div
                        key={`pulse-${i}`}
                        className="absolute top-px pointer-events-none"
                        style={{
                          left: `${toPercent(sceneIdx)}%`,
                          width: '1px',
                          height: 'calc(100% - 2px)',
                          backgroundColor: '#fff',
                          opacity: 0.12,
                        }}
                      />
                    );
                  })}

                  {/* Transition markers */}
                  {transitions.map((t, i) => {
                    const leftPct = toPercent(t.sceneIdx);
                    const color = STATUS_COLORS[t.to] ?? '#FFF';
                    return (
                      <div
                        key={`trans-${i}`}
                        className="absolute pointer-events-none"
                        style={{
                          left: `${leftPct}%`,
                          top: 0,
                          width: '2px',
                          height: '100%',
                          backgroundColor: color,
                          opacity: 0.85,
                          transform: 'translateX(-1px)',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/6 flex-wrap">
        {Object.entries(STATUS_COLORS).filter(([s]) => s !== 'abandoned').map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 text-[10px] text-text-dim">
            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: color, opacity: 0.45 }} />
            <span className="capitalize">{status}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] text-text-dim ml-1">
          <span className="w-0.5 h-3 bg-white/50 rounded" />
          Transition
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-text-dim">
          <span className="w-px h-3 bg-white/15" />
          Pulse
        </span>
      </div>
    </div>
  );
}
