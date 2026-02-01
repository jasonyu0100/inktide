'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';

const MOCK_CHARACTERS = ['Kael Mercer', 'Iona Fell', 'Dren Vasari', 'Petra Solenne'];
const MOCK_LOCATIONS = ['The Hollowed Citadel', 'Ashenmere Docks', 'The Gilt Corridor'];
const MOCK_RELATIONSHIPS = [
  'Kael trusts Iona but resents her authority',
  'Dren owes a debt to Petra that neither speaks of',
  'Iona suspects Dren is hiding something dangerous',
];

function SkeletonLoading() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-3 w-3/4 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-3 w-1/2 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-3 w-5/6 bg-white/[0.06] rounded animate-pulse" />
      <div className="h-3 w-2/3 bg-white/[0.06] rounded animate-pulse" />
    </div>
  );
}

export function WorldGenStep() {
  const { dispatch } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text-primary">Generating world&hellip;</h2>
        <SkeletonLoading />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-text-dim mb-2">
          Characters Generated
        </h3>
        <ul className="flex flex-col gap-1">
          {MOCK_CHARACTERS.map((name) => (
            <li key={name} className="text-sm text-text-primary">{name}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-text-dim mb-2">
          Locations
        </h3>
        <ul className="flex flex-col gap-1">
          {MOCK_LOCATIONS.map((name) => (
            <li key={name} className="text-sm text-text-primary">{name}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-text-dim mb-2">
          Relationships
        </h3>
        <ul className="flex flex-col gap-1">
          {MOCK_RELATIONSHIPS.map((desc) => (
            <li key={desc} className="text-sm text-text-secondary">{desc}</li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'premise' })}
          className="text-text-dim text-xs hover:text-text-secondary transition"
        >
          &larr; Back
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_WIZARD_STEP', step: 'thread-selection' })}
          className="bg-white/[0.08] hover:bg-white/[0.12] text-text-primary text-xs font-semibold px-4 py-2 rounded-lg transition"
        >
          Continue &rarr;
        </button>
      </div>
    </div>
  );
}
