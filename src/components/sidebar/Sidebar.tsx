'use client';

import ThreadPortfolio from '@/components/sidebar/ThreadPortfolio';

export default function Sidebar() {
  return (
    <div className="glass-panel flex flex-col h-full border-r border-border">
      <ThreadPortfolio />
    </div>
  );
}
