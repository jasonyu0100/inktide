'use client';

import { StoreProvider, useStore } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/sidebar/Sidebar';
import SidePanel from '@/components/inspector/SidePanel';
import WorldGraph from '@/components/canvas/WorldGraph';
import FloatingPalette from '@/components/canvas/FloatingPalette';
import TimelineStrip from '@/components/timeline/TimelineStrip';
import ForceCharts from '@/components/timeline/ForceCharts';
import NarrativePanel from '@/components/narrative/NarrativePanel';
import { CreationWizard } from '@/components/wizard/CreationWizard';
import { NarrativesScreen } from '@/components/narratives/NarrativesScreen';

function NarrativeApp() {
  const { state } = useStore();

  if (!state.activeNarrativeId) {
    return (
      <>
        <NarrativesScreen />
        {state.wizardOpen && <CreationWizard />}
      </>
    );
  }

  return (
    <>
      <AppShell
        sidebar={<Sidebar />}
        sidepanel={<SidePanel />}
      >
        <div className="relative flex flex-col h-full">
          {/* World Graph Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <WorldGraph />
            <FloatingPalette />
          </div>

          {/* Narrative Panel — prose summary */}
          <NarrativePanel />

          {/* Timeline Strip */}
          <TimelineStrip />

          {/* Force Charts */}
          <ForceCharts />
        </div>
      </AppShell>
      {state.wizardOpen && <CreationWizard />}
    </>
  );
}

export default function Home() {
  return (
    <StoreProvider>
      <NarrativeApp />
    </StoreProvider>
  );
}
