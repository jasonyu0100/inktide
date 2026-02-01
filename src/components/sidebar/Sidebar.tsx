'use client';

import SeriesPicker from '@/components/sidebar/SeriesPicker';
import ThreadPortfolio from '@/components/sidebar/ThreadPortfolio';

export default function Sidebar() {
  return (
    <div className="bg-bg-panel w-[200px] flex flex-col h-full">
      <SeriesPicker />
      <div className="border-t border-border my-2" />
      <ThreadPortfolio />
    </div>
  );
}
