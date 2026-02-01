'use client';

import { useStore } from '@/lib/store';
import EmptyState from './EmptyState';
import SceneDetail from './SceneDetail';
import CharacterDetail from './CharacterDetail';
import LocationDetail from './LocationDetail';
import ThreadDetail from './ThreadDetail';

export default function SidePanel() {
  const { state } = useStore();
  const ctx = state.inspectorContext;

  function renderContent() {
    if (!ctx) return <EmptyState />;

    switch (ctx.type) {
      case 'scene':
        return <SceneDetail sceneId={ctx.sceneId} />;
      case 'character':
        return <CharacterDetail characterId={ctx.characterId} />;
      case 'location':
        return <LocationDetail locationId={ctx.locationId} />;
      case 'thread':
        return <ThreadDetail threadId={ctx.threadId} />;
      default:
        return <EmptyState />;
    }
  }

  return (
    <aside className="h-full w-[300px] overflow-y-auto border-l border-border bg-bg-panel p-4">
      {renderContent()}
    </aside>
  );
}
