'use client';

import { useState } from 'react';
import ThreadPortfolio from '@/components/sidebar/ThreadPortfolio';
import MediaDrive from '@/components/sidebar/MediaDrive';

type Tab = 'threads' | 'media';

export default function Sidebar() {
  const [tab, setTab] = useState<Tab>('threads');

  return (
    <div className="glass-panel flex flex-col h-full border-r border-border">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-border">
        <button
          onClick={() => setTab('threads')}
          className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
            tab === 'threads'
              ? 'text-text-primary border-b border-accent'
              : 'text-text-dim hover:text-text-secondary'
          }`}
        >
          Threads
        </button>
        <button
          onClick={() => setTab('media')}
          className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${
            tab === 'media'
              ? 'text-text-primary border-b border-accent'
              : 'text-text-dim hover:text-text-secondary'
          }`}
        >
          Drive
        </button>
      </div>

      {tab === 'threads' ? <ThreadPortfolio /> : <MediaDrive />}
    </div>
  );
}
