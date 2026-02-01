'use client';

import { useStore } from '@/lib/store';

type Props = {
  sceneId: string;
};

export default function SceneDetail({ sceneId }: Props) {
  const { state, dispatch } = useStore();
  const narrative = state.activeNarrative;
  if (!narrative) return null;

  const scene = narrative.scenes[sceneId];
  if (!scene) return null;

  const location = narrative.locations[scene.locationId];
  const { pressure, momentum, flux } = scene.forceSnapshot;

  const arc = Object.values(narrative.arcs).find((a) =>
    a.sceneIds.includes(sceneId)
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Scene ID + Arc */}
      <div className="flex items-baseline gap-2">
        <h2 className="font-mono text-xs text-text-dim">{scene.id}</h2>
        {arc && (
          <span className="text-[10px] text-text-dim uppercase tracking-wider">
            {arc.name}
          </span>
        )}
      </div>

      {/* Location */}
      {location && (
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'SET_INSPECTOR',
              context: { type: 'location', locationId: location.id },
            })
          }
          className="text-left text-xs text-text-secondary transition-colors hover:text-text-primary"
        >
          {location.name}
        </button>
      )}

      {/* Participants */}
      {scene.participantIds.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Participants
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {scene.participantIds.map((cid) => {
              const character = narrative.characters[cid];
              if (!character) return null;
              return (
                <button
                  key={cid}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_INSPECTOR',
                      context: { type: 'character', characterId: cid },
                    })
                  }
                  className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-text-primary transition-colors hover:bg-white/12"
                >
                  {character.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Force Snapshot */}
      <div>
        <div className="flex gap-3">
          <ForceBar label="Pressure" value={pressure} color="#EF4444" />
          <ForceBar label="Momentum" value={momentum} color="#22C55E" />
          <ForceBar label="Flux" value={flux} color="#3B82F6" />
        </div>
      </div>

      {/* Character Movements */}
      {scene.characterMovements && Object.keys(scene.characterMovements).length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Movements
          </h3>
          {Object.entries(scene.characterMovements).map(([charId, toLocId]) => {
            const charName = narrative.characters[charId]?.name ?? charId;
            const toLocName = narrative.locations[toLocId]?.name ?? toLocId;
            return (
              <div key={charId} className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_INSPECTOR',
                      context: { type: 'character', characterId: charId },
                    })
                  }
                  className="text-text-primary transition-colors hover:underline"
                >
                  {charName}
                </button>
                <span className="text-text-dim">&rarr;</span>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'SET_INSPECTOR',
                      context: { type: 'location', locationId: toLocId },
                    })
                  }
                  className="text-text-secondary transition-colors hover:text-text-primary"
                >
                  {toLocName}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Thread Mutations */}
      {scene.threadMutations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Thread Mutations
          </h3>
          {scene.threadMutations.map((tm) => (
            <div key={tm.threadId} className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'SET_INSPECTOR',
                    context: { type: 'thread', threadId: tm.threadId },
                  })
                }
                className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-text-primary transition-colors hover:bg-white/12"
              >
                {tm.threadId}
              </button>
              <span className="text-text-dim">
                {tm.from} &rarr; {tm.to}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Knowledge Mutations */}
      {scene.knowledgeMutations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Knowledge Mutations
          </h3>
          {scene.knowledgeMutations.map((km) => {
            const charName = narrative.characters[km.characterId]?.name ?? km.characterId;
            return (
              <div key={`${km.characterId}-${km.nodeId}`} className="flex flex-col gap-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'SET_INSPECTOR',
                        context: { type: 'character', characterId: km.characterId },
                      })
                    }
                    className="text-text-primary transition-colors hover:underline"
                  >
                    {charName}
                  </button>
                  <span className={km.action === 'added' ? 'text-momentum' : 'text-pressure'}>
                    {km.action === 'added' ? '+' : '−'}
                  </span>
                  <span className="font-mono text-[10px] text-text-dim">{km.nodeId}</span>
                </div>
                <span className="text-text-secondary pl-2">{km.content}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Relationship Mutations */}
      {scene.relationshipMutations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Relationship Mutations
          </h3>
          {scene.relationshipMutations.map((rm) => {
            const fromName = narrative.characters[rm.from]?.name ?? rm.from;
            const toName = narrative.characters[rm.to]?.name ?? rm.to;
            return (
              <div key={`${rm.from}-${rm.to}`} className="flex flex-col gap-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'SET_INSPECTOR',
                        context: { type: 'character', characterId: rm.from },
                      })
                    }
                    className="text-text-primary transition-colors hover:underline"
                  >
                    {fromName}
                  </button>
                  <span className="text-text-dim">&harr;</span>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'SET_INSPECTOR',
                        context: { type: 'character', characterId: rm.to },
                      })
                    }
                    className="text-text-primary transition-colors hover:underline"
                  >
                    {toName}
                  </button>
                  <span className={rm.valenceDelta >= 0 ? 'text-momentum' : 'text-pressure'}>
                    {rm.valenceDelta > 0 ? '+' : ''}{rm.valenceDelta}
                  </span>
                </div>
                <span className="text-text-secondary pl-2">{rm.type}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Events */}
      {scene.events.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-[10px] uppercase tracking-widest text-text-dim">
            Events
          </h3>
          <ul className="flex flex-col gap-0.5">
            {scene.events.map((evt) => (
              <li key={evt} className="text-xs text-text-dim">
                {evt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ForceBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-[10px] uppercase text-text-dim">{label}</span>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${Math.max(0, Math.min(1, value)) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
