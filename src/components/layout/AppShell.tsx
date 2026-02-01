'use client';

import type { ReactNode } from 'react';
import TopBar from '@/components/topbar/TopBar';

type AppShellProps = {
  children: ReactNode;
  sidebar: ReactNode;
  sidepanel: ReactNode;
};

export default function AppShell({ children, sidebar, sidepanel }: AppShellProps) {
  return (
    <div
      className="h-screen bg-bg-base grid"
      style={{
        gridTemplateRows: '44px 1fr',
        gridTemplateColumns: '200px 1fr 300px',
      }}
    >
      {/* TopBar: row 1, spans all columns */}
      <div className="col-span-3">
        <TopBar />
      </div>

      {/* Sidebar: row 2, col 1 */}
      <div className="row-start-2 col-start-1 overflow-hidden">
        {sidebar}
      </div>

      {/* Canvas / main content area: row 2, col 2 */}
      <div className="row-start-2 col-start-2 overflow-auto">
        {children}
      </div>

      {/* Side panel: row 2, col 3 */}
      <div className="row-start-2 col-start-3 overflow-hidden">
        {sidepanel}
      </div>
    </div>
  );
}
