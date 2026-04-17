'use client';

/**
 * GameView — scene-by-scene game analysis.
 *
 * Simple flow:
 *   1. Left panel lists threads active this turn
 *   2. Select a thread → see the 2×2 matrix for the key pair
 *   3. Below the matrix: the log entries for this turn
 *   4. Toggle thread/entity view for full history
 *
 * One game. One matrix. One log stream.
 */

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { NarrativeState, PayoffMatrix, Scene } from '@/types/narrative';
import {
  extractGameState,
  computePlayerGTO,
  computeThreatMap,
  computeBetrayals,
  computeTrustPairs,
  type GameState,
  type ThreadGame,
  type PairwiseGame,
  type GameMove,
  type GameProperties,
  type PlayerGTO,

} from '@/lib/game-extract';

type Props = { narrative: NarrativeState };
type ViewMode = 'turn' | 'thread' | 'entity' | 'dashboard';

export default function GameView({ narrative }: Props) {
  const { state, dispatch } = useStore();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [activeMoveIdx, setActiveMoveIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('turn');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const currentScene: Scene | null = useMemo(() => {
    const key = state.resolvedEntryKeys[state.viewState.currentSceneIndex];
    return key ? narrative.scenes[key] ?? null : null;
  }, [narrative, state.resolvedEntryKeys, state.viewState.currentSceneIndex]);

  const fullState = useMemo(() => extractGameState(narrative), [narrative]);

  const sceneThreadIds = useMemo(() => {
    if (!currentScene) return null;
    return new Set(currentScene.threadDeltas.map((td) => td.threadId));
  }, [currentScene]);

  const sceneMoveIds = useMemo(() => {
    if (!currentScene) return new Set<string>();
    const ids = new Set<string>();
    for (const td of currentScene.threadDeltas) for (const n of td.addedNodes ?? []) if (n.id) ids.add(n.id);
    return ids;
  }, [currentScene]);

  const nameOf = useMemo(() => {
    const cache = new Map<string, string>();
    return (id: string): string => {
      if (cache.has(id)) return cache.get(id)!;
      let name = narrative.characters[id]?.name ?? narrative.locations[id]?.name ?? narrative.artifacts[id]?.name ?? null;
      if (!name) {
        outer: for (const t of Object.values(narrative.threads)) {
          for (const n of Object.values(t.threadLog?.nodes ?? {})) {
            if ((n.actorId === id || n.targetId === id) && n.content) {
              const m = n.content.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
              if (m) { name = m[1]; break outer; }
            }
          }
        }
      }
      cache.set(id, name ?? id);
      return name ?? id;
    };
  }, [narrative]);

  // All entities for entity view — only real entities (exist in character/location/artifact maps)
  const entities = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; games: number }>();
    for (const g of fullState.threadGames) {
      for (const p of g.players) {
        if (!narrative.characters[p.id] && !narrative.locations[p.id] && !narrative.artifacts[p.id]) continue;
        const e = seen.get(p.id);
        if (e) e.games++;
        else seen.set(p.id, { id: p.id, name: nameOf(p.id), games: 1 });
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.games - a.games);
  }, [fullState, nameOf, narrative]);

  // Games depend on view mode
  const displayGames = useMemo(() => {
    const all = fullState.threadGames.filter((g: ThreadGame) => !g.isChallenge);
    if (viewMode === 'turn' && sceneThreadIds) return all.filter((g: ThreadGame) => sceneThreadIds.has(g.threadId));
    if (viewMode === 'entity' && selectedEntity) return all.filter((g: ThreadGame) => g.players.some((p) => p.id === selectedEntity));
    return all;
  }, [fullState, viewMode, sceneThreadIds, selectedEntity]);

  const activeGame = selectedGame ? displayGames.find((g) => g.threadId === selectedGame) ?? displayGames[0] : displayGames[0];

  // This turn's moves for the active game
  const turnMoves = useMemo(() => {
    if (!activeGame) return [];
    return activeGame.moves.filter((m) => sceneMoveIds.has(m.nodeId));
  }, [activeGame, sceneMoveIds]);

  // Auto-select the best pairwise game: prioritise selected entity in entity mode, then turn moves
  const bestPair = useMemo((): PairwiseGame | null => {
    if (!activeGame) return null;
    const moveActors = new Set(turnMoves.flatMap((m) => [m.actorId, m.targetId].filter(Boolean)));
    // Entity mode: prioritise pairs involving the selected entity
    if (viewMode === 'entity' && selectedEntity) {
      const entityWithMatrix = activeGame.pairwiseGames.find((pw) => pw.matrix && (pw.playerA === selectedEntity || pw.playerB === selectedEntity));
      if (entityWithMatrix) return entityWithMatrix;
      const entityAny = activeGame.pairwiseGames.find((pw) => pw.playerA === selectedEntity || pw.playerB === selectedEntity);
      if (entityAny) return entityAny;
    }
    // First: pair with matrix whose players are in this turn's moves
    const active = activeGame.pairwiseGames.find((pw) => pw.matrix && (moveActors.has(pw.playerA) || moveActors.has(pw.playerB)));
    if (active) return active;
    // Second: any pair with matrix
    const withMatrix = activeGame.pairwiseGames.find((pw) => pw.matrix);
    if (withMatrix) return withMatrix;
    // Third: pair whose players are in moves
    const fromMoves = activeGame.pairwiseGames.find((pw) => moveActors.has(pw.playerA) || moveActors.has(pw.playerB));
    return fromMoves ?? activeGame.pairwiseGames[0] ?? null;
  }, [activeGame, turnMoves, viewMode, selectedEntity]);

  // Moves depend on view mode
  const displayMoves = useMemo(() => {
    if (!activeGame) return [];
    if (viewMode === 'turn' && !showFullHistory) return turnMoves;
    if (viewMode === 'entity' && selectedEntity && !showFullHistory) {
      return activeGame.moves.filter((m: GameMove) => m.actorId === selectedEntity || m.targetId === selectedEntity);
    }
    return activeGame.moves; // thread mode or showFullHistory = everything
  }, [activeGame, viewMode, showFullHistory, turnMoves, selectedEntity]);

  // Other matrices available (for subtle toggle)
  const otherMatrices = useMemo(() => {
    if (!activeGame || !bestPair) return [];
    return activeGame.pairwiseGames.filter((pw) => pw.matrix && pw !== bestPair);
  }, [activeGame, bestPair]);

  const [overridePair, setOverridePair] = useState<number | null>(null);
  const activePw = overridePair !== null ? activeGame?.pairwiseGames[overridePair] ?? bestPair : bestPair;

  // Reset override when game changes
  const activeGameId = activeGame?.threadId;
  useMemo(() => { setOverridePair(null); setShowFullHistory(false); setActiveMoveIdx(0); }, [activeGameId]);

  // Dashboard data (computed lazily) — filter out phantom IDs from rankings
  const dashboardData = useMemo(() => {
    if (viewMode !== 'dashboard') return null;
    const gto = computePlayerGTO(fullState).filter((p) =>
      narrative.characters[p.id] || narrative.locations[p.id] || narrative.artifacts[p.id]
    );
    return {
      playerGTO: gto,
      threats: computeThreatMap(fullState),
      betrayals: computeBetrayals(fullState),
      trustPairs: computeTrustPairs(fullState),
    };
  }, [viewMode, fullState, narrative]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div className="w-56 shrink-0 border-r border-border flex flex-col">
        {/* View mode tabs */}
        <div className="shrink-0 flex border-b border-border">
          {(['turn', 'thread', 'entity', 'dashboard'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`flex-1 py-1.5 text-[8px] font-semibold uppercase tracking-wider transition-colors ${viewMode === m ? 'text-text-primary bg-white/5' : 'text-text-dim/50 hover:text-text-dim/50'}`}
            >{m === 'dashboard' ? 'Dash' : m}</button>
          ))}
        </div>
        {/* Entity selector — shown in entity mode */}
        {viewMode === 'entity' && (
          <div className="shrink-0 border-b border-border max-h-36 overflow-y-auto">
            {entities.map((e) => (
              <button key={e.id} onClick={() => { setSelectedEntity(e.id); setSelectedGame(null); dispatch({ type: 'SET_INSPECTOR', context: narrative.characters[e.id] ? { type: 'character', characterId: e.id } : narrative.locations[e.id] ? { type: 'location', locationId: e.id } : { type: 'artifact', artifactId: e.id } }); }}
                className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors ${selectedEntity === e.id ? 'bg-white/8 text-text-primary' : 'text-text-dim/50 hover:bg-white/3'}`}
              >{e.name} <span className="text-text-dim/60">({e.games})</span></button>
            ))}
          </div>
        )}

        {/* Game list — turn, thread, entity modes */}
        <div className="flex-1 overflow-y-auto">
          {viewMode !== 'dashboard' && displayGames.map((g) => {
            const active = activeGame?.threadId === g.threadId;
            const movesForDots = viewMode === 'turn' ? g.moves.filter((m: GameMove) => sceneMoveIds.has(m.nodeId)) : g.moves;
            const stateColor = g.gameState === 'endgame' ? 'text-fate' : g.gameState === 'committed' ? 'text-orange-400' : g.gameState === 'midgame' ? 'text-blue-400' : g.gameState === 'resolved' ? 'text-world' : g.gameState === 'broken' ? 'text-violet-400' : 'text-text-dim/50';
            return (
              <button key={g.threadId} onClick={() => { setSelectedGame(g.threadId); setOverridePair(null); setShowFullHistory(false); setActiveMoveIdx(0); dispatch({ type: 'SET_INSPECTOR', context: { type: 'thread', threadId: g.threadId } }); }}
                className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors ${active ? 'bg-white/8' : 'hover:bg-white/3'}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[8px] font-semibold uppercase ${stateColor}`}>{g.gameState}</span>
                  {g.trajectory !== 'developing' && <span className={`text-[8px] ${g.trajectory === 'volatile' ? 'text-orange-400/80' : g.trajectory === 'contested' ? 'text-amber-400/80' : g.trajectory === 'momentum' ? 'text-emerald-400/80' : 'text-text-dim/20'}`}>{g.trajectory}</span>}
                </div>
                <div className="text-[10px] text-text-secondary leading-snug line-clamp-2">{g.question}</div>
                {movesForDots.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {movesForDots.slice(-8).map((m: GameMove, i: number) => (
                      <span key={i} className={`w-1.5 h-1.5 rounded-full ${m.stance === 'cooperative' ? 'bg-emerald-400' : m.stance === 'competitive' ? 'bg-red-400' : 'bg-white/15'}`} />
                    ))}
                    <span className="text-[8px] text-text-dim/50 ml-auto">{movesForDots.length}</span>
                  </div>
                )}
              </button>
            );
          })}
          {viewMode !== 'dashboard' && displayGames.length === 0 && (
            <p className="text-[10px] text-text-dim/50 italic p-4 text-center">
              {viewMode === 'turn' ? 'No games this turn' : viewMode === 'entity' && !selectedEntity ? 'Select an entity' : 'No games'}
            </p>
          )}

          {/* Dashboard sidebar — game state summary + player roster */}
          {viewMode === 'dashboard' && (() => {
            const stateDist = { endgame: 0, committed: 0, midgame: 0, setup: 0, resolved: 0, broken: 0 };
            for (const g of fullState.threadGames.filter((g: ThreadGame) => !g.isChallenge)) {
              stateDist[g.gameState as keyof typeof stateDist] = (stateDist[g.gameState as keyof typeof stateDist] ?? 0) + 1;
            }
            const stateEntries = (['endgame', 'committed', 'midgame', 'setup', 'resolved', 'broken'] as const).filter((s) => stateDist[s] > 0);
            const gtoMap = new Map(computePlayerGTO(fullState).map((p) => [p.id, p]));
            return (
              <>
                {/* Game states */}
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-1.5">Game States</div>
                  <div className="flex flex-col gap-0.5">
                    {stateEntries.map((gs) => {
                      const color = gs === 'endgame' ? 'text-fate' : gs === 'committed' ? 'text-orange-400' : gs === 'midgame' ? 'text-blue-400' : gs === 'resolved' ? 'text-world' : gs === 'broken' ? 'text-violet-400' : 'text-text-dim/60';
                      return (
                        <div key={gs} className="flex items-center justify-between">
                          <span className={`text-[9px] ${color}`}>{gs}</span>
                          <span className="text-[9px] text-text-dim/60 tabular-nums">{stateDist[gs]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Player roster */}
                <div className="px-3 py-1.5 border-b border-border">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold">Players</div>
                </div>
                {entities.map((e) => {
                  const gto = gtoMap.get(e.id);
                  const desc = gto ? describePlayer(gto) : '';
                  return (
                    <button key={e.id} onClick={() => dispatch({ type: 'SET_INSPECTOR', context: narrative.characters[e.id] ? { type: 'character', characterId: e.id } : narrative.locations[e.id] ? { type: 'location', locationId: e.id } : { type: 'artifact', artifactId: e.id } })}
                      className="w-full text-left px-3 py-1.5 border-b border-white/5 hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-text-secondary">{e.name}</span>
                        <span className="text-[9px] text-text-dim/50 tabular-nums">{gto?.totalMoves ?? 0}</span>
                      </div>
                      {desc && <div className="text-[8px] text-text-dim/70 font-medium mt-0.5">{desc}</div>}
                    </button>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {/* Main panel */}
      {viewMode === 'dashboard' && dashboardData ? (
        <DashboardPanel data={dashboardData} state={fullState} nameOf={nameOf} dispatch={dispatch} narrative={narrative} />
      ) : activeGame && activePw ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* ── Navigation bar — single strip ── */}
          <div className="shrink-0 border-b border-border px-5 h-10 flex items-center">
            {/* Scene stepper */}
            <div className="flex items-center gap-1">
              <button onClick={() => dispatch({ type: 'PREV_SCENE' })}
                className="p-1 rounded text-text-dim/60 hover:text-text-primary transition-colors disabled:opacity-15"
                disabled={state.viewState.currentSceneIndex <= 0}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span className="text-[12px] text-text-primary tabular-nums font-medium px-1">
                {state.viewState.currentSceneIndex + 1}<span className="text-text-dim/60 font-normal">/{state.resolvedEntryKeys.length}</span>
              </span>
              <button onClick={() => dispatch({ type: 'NEXT_SCENE' })}
                className="p-1 rounded text-text-dim/60 hover:text-text-primary transition-colors disabled:opacity-15"
                disabled={state.viewState.currentSceneIndex >= state.resolvedEntryKeys.length - 1}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {/* Game state + trajectory */}
            <div className="flex items-center gap-2 ml-4">
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                activeGame.gameState === 'endgame' ? 'text-fate' :
                activeGame.gameState === 'committed' ? 'text-orange-400' :
                activeGame.gameState === 'midgame' ? 'text-blue-400' :
                activeGame.gameState === 'resolved' ? 'text-world' :
                activeGame.gameState === 'broken' ? 'text-violet-400' :
                'text-text-dim/50'
              }`}>{activeGame.gameState}</span>
              <span className={`text-[10px] ${
                activeGame.trajectory === 'volatile' ? 'text-orange-400/80' :
                activeGame.trajectory === 'momentum' ? 'text-emerald-400/80' :
                activeGame.trajectory === 'contested' ? 'text-amber-400/80' :
                activeGame.trajectory === 'stalled' ? 'text-red-400/60' :
                'text-text-dim/50'
              }`}>{activeGame.trajectory}</span>
            </div>

            {/* Stats */}
            {(() => {
              const bal = activeGame.moveBalance;
              const temp = bal.total > 0 ? bal.competitive / bal.total : 0;
              return (
                <div className="flex items-center gap-4 ml-auto">
                  {/* Temperature */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-mono font-semibold tabular-nums ${
                      temp > 0.5 ? 'text-red-400' : temp > 0.3 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>{(temp * 100).toFixed(0)}%</span>
                    <span className="text-[9px] text-text-dim/60">temp</span>
                  </div>

                  {/* Move balance bar */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono font-semibold tabular-nums text-text-primary">{bal.total}</span>
                    <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-white/5 w-14">
                      {bal.total > 0 && <>
                        {bal.cooperative > 0 && <div className="bg-emerald-400/60 h-full" style={{ width: `${(bal.cooperative / bal.total) * 100}%` }} />}
                        {bal.neutral > 0 && <div className="bg-white/15 h-full" style={{ width: `${(bal.neutral / bal.total) * 100}%` }} />}
                        {bal.competitive > 0 && <div className="bg-red-400/60 h-full" style={{ width: `${(bal.competitive / bal.total) * 100}%` }} />}
                      </>}
                    </div>
                  </div>

                  {/* Momentum */}
                  <div className="flex items-center gap-1">
                    <span className={`text-[11px] font-mono font-semibold tabular-nums ${
                      activeGame.momentum > 0.3 ? 'text-emerald-400' : activeGame.momentum < -0.3 ? 'text-red-400' : 'text-text-dim/50'
                    }`}>{activeGame.momentum > 0 ? '+' : ''}{activeGame.momentum.toFixed(1)}</span>
                    {activeGame.volatility > 0.3 && <span className="text-[9px] text-text-dim/60">{activeGame.volatility.toFixed(1)}v</span>}
                  </div>

                  {/* History toggle */}
                  <button
                    onClick={() => setShowFullHistory(!showFullHistory)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      showFullHistory
                        ? 'bg-white/8 text-text-secondary'
                        : 'text-text-dim/55 hover:text-text-dim/60'
                    }`}
                  >
                    {showFullHistory ? 'All' : 'Turn'}
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-6 py-5 flex flex-col gap-5">

              {/* Move display */}
              {displayMoves.length > 0 && (() => {
                const idx = Math.min(activeMoveIdx, displayMoves.length - 1);
                const m = displayMoves[idx];
                return (
                  <div>
                    <p className="text-[15px] text-text-primary leading-relaxed">{m.content}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {m.attributed && (
                        <span className="text-[11px] text-text-secondary">{nameOf(m.actorId!)}{m.targetId ? ` \u2192 ${nameOf(m.targetId)}` : ''}</span>
                      )}
                      <span className={`text-[10px] ${m.stance === 'cooperative' ? 'text-emerald-400/70' : m.stance === 'competitive' ? 'text-red-400/70' : 'text-text-dim/50'}`}>{m.stance}</span>
                      {m.matrixCell && (
                        <span className={`text-[10px] font-mono font-medium ${
                          m.matrixCell === 'cc' ? 'text-emerald-400/80' :
                          m.matrixCell === 'dd' ? 'text-red-400/60' :
                          'text-amber-400/80'
                        }`}>{m.matrixCell}</span>
                      )}
                      {/* Move stepper — only when multiple */}
                      {displayMoves.length > 1 && (
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => setActiveMoveIdx(Math.max(0, idx - 1))} disabled={idx === 0}
                            className="p-0.5 rounded text-text-dim/50 hover:text-text-primary transition-colors disabled:opacity-15"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                          <span className="text-[11px] text-text-dim/60 tabular-nums">{idx + 1}/{displayMoves.length}</span>
                          <button onClick={() => setActiveMoveIdx(Math.min(displayMoves.length - 1, idx + 1))} disabled={idx >= displayMoves.length - 1}
                            className="p-0.5 rounded text-text-dim/50 hover:text-text-primary transition-colors disabled:opacity-15"
                          >
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M5.5 3L9.5 7l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Thread question */}
              <p className="text-[10px] text-text-dim/55 leading-snug">{activeGame.question}</p>

              {/* THE MATRIX */}
              {activePw.matrix && activePw.properties && (() => {
                const idx = Math.min(activeMoveIdx, displayMoves.length - 1);
                const activeMove = displayMoves[idx];
                let playedCell: 'cc' | 'cd' | 'dc' | 'dd' | null = null;
                const raw = activeMove?.matrixCell;
                if (raw === 'cc' || raw === 'cd' || raw === 'dc' || raw === 'dd') {
                  const actorIsB = activeMove?.actorId === activePw.playerB;
                  if (actorIsB && raw === 'dc') playedCell = 'cd';
                  else if (actorIsB && raw === 'cd') playedCell = 'dc';
                  else playedCell = raw;
                }
                return (
                  <Board
                    matrix={activePw.matrix!}
                    props={activePw.properties!}
                    aName={nameOf(activePw.playerA)}
                    bName={nameOf(activePw.playerB)}
                    perspectiveA={activePw.playerA}
                    playedCell={playedCell}
                    stakeA={activePw.stakeA}
                    stakeB={activePw.stakeB}
                  />
                );
              })()}

              {/* Analysis */}
              {activePw.properties && <AnalysisBlock props={activePw.properties} aName={nameOf(activePw.playerA)} bName={nameOf(activePw.playerB)} />}

              {/* Players — compact inline */}
              {activeGame.players.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {activeGame.players.map((p) => {
                    const pMoves = activeGame.moves.filter((m) => m.actorId === p.id);
                    const pCoop = pMoves.filter((m) => m.stance === 'cooperative').length;
                    const pComp = pMoves.filter((m) => m.stance === 'competitive').length;
                    const pTotal = pMoves.length;
                    return (
                      <div key={p.id}
                        className="flex items-center gap-3 rounded-lg bg-white/3 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => dispatch({ type: 'SET_INSPECTOR', context: { type: p.kind === 'character' ? 'character' : p.kind === 'location' ? 'location' : 'artifact', [`${p.kind}Id`]: p.id } as any })}
                      >
                        <span className="text-[11px] text-text-primary font-medium">{p.name}</span>
                        <span className={`text-[9px] ${
                          p.posture === 'strategist' ? 'text-sky-400/60' :
                          p.posture === 'operator' ? 'text-emerald-400/80' :
                          p.posture === 'reactive' ? 'text-amber-400/80' :
                          p.posture === 'vulnerable' ? 'text-red-400/60' :
                          'text-text-dim/50'
                        }`}>{p.posture}</span>
                        <div className="flex-1" />
                        {pTotal > 0 && (
                          <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-white/5 w-12">
                            {pCoop > 0 && <div className="bg-emerald-400/60 h-full" style={{ width: `${(pCoop / pTotal) * 100}%` }} />}
                            {pComp > 0 && <div className="bg-red-400/60 h-full" style={{ width: `${(pComp / pTotal) * 100}%` }} />}
                          </div>
                        )}
                        <span className="text-[10px] tabular-nums text-text-dim/60">{pTotal}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Other matrices */}
              {otherMatrices.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {otherMatrices.map((pw) => {
                    const idx = activeGame.pairwiseGames.indexOf(pw);
                    return (
                      <button key={idx} onClick={() => setOverridePair(overridePair === idx ? null : idx)}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                          overridePair === idx ? 'bg-white/10 text-text-secondary' : 'bg-white/3 text-text-dim/60 hover:text-text-dim/60'
                        }`}
                      >{nameOf(pw.playerA)} vs {nameOf(pw.playerB)}</button>
                    );
                  })}
                </div>
              )}

              {/* Move log */}
              {displayMoves.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-text-dim/60 font-medium">
                      {showFullHistory ? 'Full history' : viewMode === 'entity' ? 'Entity moves' : 'This turn'} ({displayMoves.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {displayMoves.map((m, i) => (
                      <MoveRow key={m.nodeId} move={m} index={i} nameOf={nameOf} pairwise={activePw} active={i === Math.min(activeMoveIdx, displayMoves.length - 1)} onSelect={() => setActiveMoveIdx(i)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-text-dim/50 italic">Select a game</p>
        </div>
      )}
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

function Board({ matrix, props, aName, bName, perspectiveA, playedCell, stakeA, stakeB }: {
  matrix: PayoffMatrix; props: GameProperties; aName: string; bName: string; perspectiveA: string;
  playedCell: 'cc' | 'cd' | 'dc' | 'dd' | null;
  stakeA: string | null; stakeB: string | null;
}) {
  const flipped = matrix.playerA !== perspectiveA;
  const pA = (c: { payoffA: number; payoffB: number }) => flipped ? c.payoffB : c.payoffA;
  const pB = (c: { payoffA: number; payoffB: number }) => flipped ? c.payoffA : c.payoffB;
  const nashSet = new Set(props.nashEquilibria);

  // Axis labels: action descriptions > stakes > generic
  const coopA = (flipped ? matrix.actionB : matrix.actionA) ?? (stakeA ? `advances ${stakeA}` : 'cooperates');
  const defA = (flipped ? matrix.defectB : matrix.defectA) ?? (stakeA ? `blocks ${stakeA}` : 'defects');
  const coopB = (flipped ? matrix.actionA : matrix.actionB) ?? (stakeB ? `advances ${stakeB}` : 'cooperates');
  const defB = (flipped ? matrix.defectA : matrix.defectB) ?? (stakeB ? `blocks ${stakeB}` : 'defects');

  const Cell = ({ cell, cellKey, row, col }: { cell: PayoffMatrix['cc']; cellKey: 'cc' | 'cd' | 'dc' | 'dd'; row: number; col: number }) => {
    const isNash = nashSet.has(cellKey);
    const isPlayed = playedCell === cellKey;
    const isLight = (row + col) % 2 === 0;

    return (
      <td className={`relative px-4 py-3 ${
        isPlayed ? 'bg-amber-400/10 ring-1 ring-inset ring-amber-400/30' :
        isLight ? 'bg-white/3' : ''
      }`}>
        {/* Badges */}
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          {isNash && <span className={`text-[7px] font-semibold px-1 py-px rounded ${isPlayed ? 'bg-sky-400/20 text-sky-400' : 'bg-sky-400/10 text-sky-400/60'}`}>NASH</span>}
        </div>
        {/* Payoffs */}
        <div className="flex items-baseline gap-2.5 mb-1">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-white" />
            <span className="text-[18px] font-mono font-bold text-white leading-none">{pA(cell)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-white/15" />
            <span className="text-[18px] font-mono font-bold text-white/45 leading-none">{pB(cell)}</span>
          </div>
        </div>
        {/* Outcome */}
        <p className="text-[9px] text-text-dim/70 leading-snug">{cell.outcome}</p>
      </td>
    );
  };

  return (
    <div>
      <table className="border-collapse w-full rounded-lg overflow-hidden" style={{ borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="relative px-3 py-3 w-28 border-r border-b border-white/6 overflow-hidden">
              {/* Diagonal divider — A bottom-left, B top-right */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top right, transparent calc(50% - 0.5px), rgba(255,255,255,0.06) calc(50% - 0.5px), rgba(255,255,255,0.06) calc(50% + 0.5px), transparent calc(50% + 0.5px))' }} />
              <div className="relative flex flex-col items-end gap-3">
                <span className="text-[10px] font-medium text-text-dim/50">{bName}</span>
                <span className="text-[10px] font-medium text-text-dim/50 self-start">{aName}</span>
              </div>
            </th>
            <th className="px-4 py-2 text-center border-b border-white/6">
              <div className="text-[9px] text-emerald-400/70">{coopB}</div>
            </th>
            <th className="px-4 py-2 text-center border-l border-b border-white/6">
              <div className="text-[9px] text-red-400/70">{defB}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="px-3 py-2 text-right border-r border-white/6 align-middle">
              <div className="text-[9px] text-emerald-400/70 leading-snug">{coopA}</div>
            </th>
            <Cell cell={matrix.cc} cellKey="cc" row={0} col={0} />
            <Cell cell={matrix.cd} cellKey="cd" row={0} col={1} />
          </tr>
          <tr className="border-t border-white/6">
            <th className="px-3 py-2 text-right border-r border-white/6 align-middle">
              <div className="text-[9px] text-red-400/70 leading-snug">{defA}</div>
            </th>
            <Cell cell={matrix.dc} cellKey="dc" row={1} col={0} />
            <Cell cell={matrix.dd} cellKey="dd" row={1} col={1} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Analysis ────────────────────────────────────────────────────────────────

function AnalysisBlock({ props, aName, bName }: { props: GameProperties; aName: string; bName: string }) {
  const lines: string[] = [];
  if (props.hasSocialDilemma) lines.push('Social dilemma — cooperation optimal but defection tempting.');
  if (props.isZeroSum) lines.push('Zero-sum — one gains, the other loses.');
  if (props.isMutuallyBeneficial) lines.push('Mutual cooperation is optimal for both.');
  if (props.hasDominantStrategy) {
    const who = props.dominantPlayer === 'A' ? aName : props.dominantPlayer === 'B' ? bName : 'Both';
    lines.push(`${who} has a dominant strategy.`);
  }
  if (props.nashEquilibria.length === 0) lines.push('No pure Nash equilibrium.');
  if (props.nashEquilibria.length > 1) lines.push(`${props.nashEquilibria.length} equilibria.`);
  const inefficient = props.nashEquilibria.filter((ne) => !new Set(props.paretoOptimal).has(ne));
  if (inefficient.length > 0) lines.push('Equilibrium is Pareto-inefficient.');
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg bg-white/3 px-3 py-2.5">
      {lines.map((l, i) => <p key={i} className="text-[10px] text-text-secondary leading-relaxed">{l}</p>)}
    </div>
  );
}

// ── Move row ────────────────────────────────────────────────────────────────

function MoveRow({ move, pairwise, active, onSelect }: { move: GameMove; index?: number; nameOf?: (id: string) => string; pairwise: PairwiseGame; active?: boolean; onSelect?: () => void }) {
  const ne = pairwise.properties?.nashEquilibria[0] ?? null;
  const isA = move.actorId === pairwise.playerA;
  const isB = move.actorId === pairwise.playerB;
  let gto: 'cooperative' | 'competitive' | null = null;
  if (ne && isA) gto = ne[0] === 'c' ? 'cooperative' : 'competitive';
  if (ne && isB) gto = ne[1] === 'c' ? 'cooperative' : 'competitive';
  const optimal = gto && move.stance === gto;
  const blunder = gto && move.stance !== gto && move.stance !== 'neutral';

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-md transition-colors ${
        active ? 'bg-white/8' :
        blunder ? 'bg-red-400/4' :
        'hover:bg-white/3 cursor-pointer'
      }`}
      onClick={onSelect}
    >
      {/* Stance dot */}
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
        move.stance === 'cooperative' ? 'bg-emerald-400/70' :
        move.stance === 'competitive' ? 'bg-red-400/70' :
        'bg-white/15'
      }`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-text-secondary leading-snug">{move.content}</p>
        <div className="flex items-center gap-1.5 mt-1 text-[9px]">
          {move.matrixCell && <span className={`font-mono font-medium ${
            move.matrixCell === 'cc' ? 'text-emerald-400/50' :
            move.matrixCell === 'dd' ? 'text-red-400/50' :
            'text-amber-400/50'
          }`}>{move.matrixCell}</span>}
          {optimal && <span className="font-semibold text-emerald-400/70">optimal</span>}
          {blunder && <span className="font-semibold text-red-400/70">blunder</span>}
        </div>
      </div>
    </div>
  );
}

// ── Player description ──────────────────────────────────────────────────────

/**
 * Classify a player into a strategic archetype from their GTO stats.
 * Uses rates (not counts) so it scales from 5 moves to 500.
 * Returns a primary label + a qualifying trait.
 */
function describePlayer(p: PlayerGTO): string {
  if (p.totalMoves === 0) return 'no recorded moves';
  if (p.declaredMoves === 0) return 'undeclared';

  // Rates — all 0-1
  const coopRate = p.coopRate;                                           // how often they advance
  const nashRate = p.gtoRate;                                            // how often they play Nash
  const initRate = p.initiated / Math.max(p.initiated + p.targeted, 1); // how often they act vs react
  const exploitRate = p.declaredMoves > 0                                // net exploitation as a rate
    ? p.netExploitation / p.declaredMoves
    : 0;

  // Primary archetype — the dominant pattern
  let primary: string;
  if (coopRate > 0.7 && nashRate > 0.6) primary = 'cooperative strategist';
  else if (coopRate > 0.7 && nashRate <= 0.6) primary = 'idealist';
  else if (coopRate < 0.3 && nashRate > 0.6) primary = 'calculated aggressor';
  else if (coopRate < 0.3 && nashRate <= 0.6) primary = 'disruptor';
  else if (nashRate > 0.8) primary = 'equilibrium player';
  else if (nashRate < 0.25 && p.declaredMoves >= 3) primary = 'wild card';
  else if (coopRate > 0.5) primary = 'cooperative';
  else primary = 'competitive';

  // Qualifying trait — the most distinctive secondary signal
  let trait = '';
  if (exploitRate > 0.15) trait = 'predatory edge';
  else if (exploitRate < -0.15) trait = 'frequently targeted';
  else if (initRate > 0.75) trait = 'drives action';
  else if (initRate < 0.25) trait = 'reactive';
  else if (Math.abs(coopRate - 0.5) < 0.1) trait = 'balanced play';

  return trait ? `${primary} · ${trait}` : primary;
}

// ── Dashboard panel ─────────────────────────────────────────────────────────

type DashboardData = {
  playerGTO: PlayerGTO[];
  threats: ReturnType<typeof computeThreatMap>;
  betrayals: ReturnType<typeof computeBetrayals>;
  trustPairs: ReturnType<typeof computeTrustPairs>;
};

function DashboardPanel({ data, state, nameOf, dispatch, narrative }: {
  data: DashboardData; state: GameState; nameOf: (id: string) => string;
  dispatch: ReturnType<typeof useStore>['dispatch']; narrative: NarrativeState;
}) {
  const s = state.summary;
  const totalMoves = state.threadGames.reduce((n, g) => n + g.moveBalance.total, 0);
  const totalComp = state.threadGames.reduce((n, g) => n + g.moveBalance.competitive, 0);
  const temperature = totalMoves > 0 ? totalComp / totalMoves : 0;
  const avgGTO = data.playerGTO.filter((p) => p.declaredMoves > 0).length > 0
    ? data.playerGTO.filter((p) => p.declaredMoves > 0).reduce((n, p) => n + p.gtoRate, 0) / data.playerGTO.filter((p) => p.declaredMoves > 0).length
    : 0;

  // Game state distribution
  const stateDist = { setup: 0, midgame: 0, committed: 0, endgame: 0, resolved: 0, broken: 0 };
  for (const g of state.threadGames) stateDist[g.gameState as keyof typeof stateDist] = (stateDist[g.gameState as keyof typeof stateDist] ?? 0) + 1;

  // Move cell distribution
  const cellDist = { cc: 0, cd: 0, dc: 0, dd: 0, none: 0 };
  for (const g of state.threadGames) for (const m of g.moves) {
    if (m.matrixCell && m.matrixCell in cellDist) cellDist[m.matrixCell as keyof typeof cellDist]++;
    else cellDist.none++;
  }
  const cellTotal = cellDist.cc + cellDist.cd + cellDist.dc + cellDist.dd;

  // Matrices coverage
  const matricesTotal = state.threadGames.reduce((n, g) => n + g.pairwiseGames.filter((pw) => pw.matrix).length, 0);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col gap-6">
        {/* Row 1: Key metrics */}
        <div className="grid grid-cols-4 gap-3">
          <DashStat label="Temperature" value={`${(temperature * 100).toFixed(0)}%`} sub="competitive ratio" color={temperature > 0.5 ? 'text-red-400' : temperature > 0.3 ? 'text-amber-400' : 'text-emerald-400'} />
          <DashStat label="Nash Rate" value={`${(avgGTO * 100).toFixed(0)}%`} sub="avg compliance" color={avgGTO > 0.7 ? 'text-emerald-400' : avgGTO > 0.4 ? 'text-amber-400' : 'text-red-400'} />
          <DashStat label="Threads" value={s.totalGames} sub={`${s.activeGames} active · ${s.challenges} challenges`} />
          <DashStat label="Matrices" value={matricesTotal} sub={`${totalMoves} moves · ${cellTotal} declared`} />
        </div>

        {/* Row 2: Game state + Move cell distribution */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-2">Game States</h3>
            <div className="flex flex-col gap-1">
              {(['endgame', 'committed', 'midgame', 'setup', 'broken', 'resolved'] as const).map((gs) => {
                const count = stateDist[gs];
                if (count === 0) return null;
                const pct = s.totalGames > 0 ? count / s.totalGames : 0;
                const color = gs === 'endgame' ? 'bg-fate' : gs === 'committed' ? 'bg-orange-400' : gs === 'midgame' ? 'bg-blue-400' : gs === 'resolved' ? 'bg-world' : gs === 'broken' ? 'bg-violet-400' : 'bg-white/20';
                return (
                  <div key={gs} className="flex items-center gap-2">
                    <span className="text-[10px] text-text-dim/50 w-20">{gs}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${color} opacity-60`} style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-text-secondary tabular-nums w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-2">Move Distribution</h3>
            <div className="flex flex-col gap-1">
              {([['cc', 'Both advance', 'bg-emerald-400'], ['cd', 'Actor advances, target blocks', 'bg-sky-400'], ['dc', 'Actor blocks, target advances', 'bg-amber-400'], ['dd', 'Both block', 'bg-red-400']] as const).map(([cell, label, color]) => {
                const count = cellDist[cell];
                const pct = cellTotal > 0 ? count / cellTotal : 0;
                return (
                  <div key={cell} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-dim/60 w-6">{cell}</span>
                    <span className="text-[9px] text-text-dim/60 w-36 truncate">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full ${color} opacity-50`} style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-text-secondary tabular-nums w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Player rankings */}
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-2">Player Rankings</h3>
          <div className="rounded-lg border border-white/8 overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-white/3 text-text-dim/50 text-[9px] uppercase tracking-wider">
                  <th className="text-left py-2 px-3 font-medium w-8">#</th>
                  <th className="text-left py-2 px-3 font-medium">Player</th>
                  <th className="text-right py-2 px-3 font-medium">Moves</th>
                  <th className="text-center py-2 px-3 font-medium">Strategy</th>
                  <th className="text-right py-2 px-3 font-medium">Nash</th>
                  <th className="text-right py-2 px-3 font-medium">Advance</th>
                  <th className="text-right py-2 px-3 font-medium">Edge</th>
                </tr>
              </thead>
              <tbody>
                {data.playerGTO.slice(0, 12).map((p, i) => {
                  const nashPct = p.declaredMoves > 0 ? (p.gtoRate * 100).toFixed(0) : '—';
                  const coopPct = p.declaredMoves > 0 ? (p.coopRate * 100).toFixed(0) : '—';
                  const blockPct = p.declaredMoves > 0 ? ((1 - p.coopRate) * 100).toFixed(0) : '0';
                  return (
                    <tr key={p.id}
                      className="border-t border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                      onClick={() => dispatch({ type: 'SET_INSPECTOR', context: narrative.characters[p.id] ? { type: 'character', characterId: p.id } : narrative.locations[p.id] ? { type: 'location', locationId: p.id } : { type: 'artifact', artifactId: p.id } })}
                    >
                      <td className="py-2.5 px-3 text-text-dim/50 tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="text-text-primary font-medium">{p.name}</div>
                        <div className="text-[9px] text-text-dim/70 font-medium mt-0.5">{describePlayer(p)}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{p.totalMoves}</td>
                      <td className="py-2.5 px-3">
                        {/* Strategy bar: green=advance, red=block */}
                        <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-white/5 w-20 mx-auto">
                          {Number(coopPct) > 0 && <div className="bg-emerald-400/70 h-full" style={{ width: `${coopPct}%` }} />}
                          {Number(blockPct) > 0 && <div className="bg-red-400/70 h-full" style={{ width: `${blockPct}%` }} />}
                        </div>
                      </td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                        nashPct === '—' ? 'text-text-dim/50' :
                        Number(nashPct) > 70 ? 'text-emerald-400' :
                        Number(nashPct) > 40 ? 'text-amber-400' : 'text-red-400'
                      }`}>{nashPct}{nashPct !== '—' ? '%' : ''}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{coopPct}{coopPct !== '—' ? '%' : ''}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                        p.netExploitation > 0 ? 'text-emerald-400' : p.netExploitation < 0 ? 'text-red-400' : 'text-text-dim/50'
                      }`}>{p.netExploitation > 0 ? '+' : ''}{p.netExploitation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row 4: Hottest games + Cooperation & Defection */}
        <div className="grid grid-cols-2 gap-5">
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-2">Highest Tension</h3>
            <div className="flex flex-col gap-1.5">
              {data.threats.slice(0, 5).map((t) => (
                <button key={t.threadId} onClick={() => dispatch({ type: 'SET_INSPECTOR', context: { type: 'thread', threadId: t.threadId } })}
                  className="text-left p-2.5 rounded-lg border border-white/5 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`text-[9px] font-semibold ${t.gameState === 'endgame' ? 'text-fate' : t.gameState === 'committed' ? 'text-orange-400' : 'text-text-dim/60'}`}>{t.gameState}</span>
                    <span className={`text-[9px] ${t.trajectory === 'volatile' ? 'text-orange-400' : t.trajectory === 'contested' ? 'text-amber-400' : 'text-text-dim/50'}`}>{t.trajectory}</span>
                    <div className="flex gap-px ml-auto">
                      {Array.from({ length: Math.round(t.heatScore * 5) }).map((_, j) => (
                        <span key={j} className="w-1.5 h-3 rounded-sm bg-red-400/60" />
                      ))}
                      {Array.from({ length: 5 - Math.round(t.heatScore * 5) }).map((_, j) => (
                        <span key={j} className="w-1.5 h-3 rounded-sm bg-white/5" />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-text-secondary leading-snug line-clamp-2">{t.question}</p>
                  <div className="flex gap-1 mt-1 text-[8px] text-text-dim/50">{t.players.slice(0, 3).join(' · ')}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold mb-2">Cooperation & Defection</h3>
            {data.trustPairs.filter((t) => t.ccCount > 0).length > 0 && (
              <div className="mb-4">
                <div className="text-[9px] text-text-dim/60 mb-1.5">Aligned pairs</div>
                {data.trustPairs.filter((t) => t.ccCount > 0).slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-1 text-[10px]">
                    <span className="text-text-secondary">{t.nameA} × {t.nameB}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${(t.ccCount / Math.max(t.totalMoves, 1)) * 100}%` }} />
                      </div>
                      <span className="text-[9px] text-text-dim/60 tabular-nums w-8 text-right">{t.ccCount}/{t.totalMoves}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {data.betrayals.length > 0 && (
              <div>
                <div className="text-[9px] text-text-dim/60 mb-1.5">Defection events</div>
                {data.betrayals.slice(0, 4).map((b, i) => (
                  <div key={i} className="py-1.5 border-b border-white/5 last:border-0">
                    <div className="text-[10px]"><span className="text-red-400 font-medium">{b.betrayerName}</span> <span className="text-text-dim/50">defected from cc</span></div>
                    <p className="text-[9px] text-text-dim/60 leading-snug mt-0.5">{b.afterContent.slice(0, 80)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashStat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
      <div className={`text-[20px] font-mono font-bold tabular-nums ${color ?? 'text-text-primary'}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-text-dim/60 mt-1">{label}</div>
      {sub && <div className="text-[8px] text-text-dim/60 mt-0.5">{sub}</div>}
    </div>
  );
}
