'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, withDerivedEntities } from '@/lib/store';
import type { NarrativeState } from '@/types/narrative';
import { resolveEntrySequence } from '@/lib/narrative-utils';
import { SlidesPlayer } from '@/components/slides/SlidesPlayer';

export default function ExamplePage() {
  const router = useRouter();
  const { dispatch } = useStore();
  const [narrative, setNarrative] = useState<NarrativeState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/works/harry_potter_and_the_sorcerer_s_stone.json')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data: NarrativeState) => {
        // Derive characters/locations/threads from scenes if the top-level dicts are empty
        const rootBranch = Object.values(data.branches).find(b => b.parentBranchId === null);
        const keys = rootBranch ? resolveEntrySequence(data.branches, rootBranch.id) : Object.keys(data.scenes);
        setNarrative(withDerivedEntities(data, keys));
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-100 bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-dim mb-4">Failed to load example data.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg bg-white/10 text-text-primary text-sm hover:bg-white/15"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!narrative) {
    return (
      <div className="fixed inset-0 z-100 bg-bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-dim text-sm">Loading example analysis&hellip;</p>
        </div>
      </div>
    );
  }

  const resolvedKeys = [
    ...Object.keys(narrative.scenes),
    ...Object.keys(narrative.worldBuilds),
  ];

  return (
    <SlidesPlayer
      narrative={narrative}
      resolvedKeys={resolvedKeys}
      onClose={() => {
        dispatch({ type: 'SET_ACTIVE_NARRATIVE', id: narrative.id });
        router.push(`/series/${narrative.id}`);
      }}
    />
  );
}
