'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { NarrativeState, Scene } from '@/types/narrative';
import { useStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { apiHeaders } from '@/lib/api-headers';

export function SceneAudioView({
  narrative,
  scene,
}: {
  narrative: NarrativeState;
  scene: Scene;
}) {
  const { dispatch } = useStore();
  const access = useFeatureAccess();

  type AudioState = { url: string; status: 'idle' | 'loading' | 'ready' | 'error'; error?: string };
  const [audioState, setAudioState] = useState<AudioState>(() =>
    scene.audioUrl ? { url: scene.audioUrl, status: 'ready' } : { url: '', status: 'idle' }
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, []);

  // Sync when scene changes
  useEffect(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioState(scene.audioUrl ? { url: scene.audioUrl, status: 'ready' } : { url: '', status: 'idle' });
  }, [scene.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // No pre-load effect — create audio on play, like StoryReader does

  const generateAudio = useCallback(async () => {
    if (!scene.prose) return;
    const voice = narrative.storySettings?.audioVoice || 'nova';
    const model = narrative.storySettings?.audioModel || 'tts-1';

    if (access.userApiKeys && !access.hasOpenAiKey) {
      window.dispatchEvent(new Event('open-api-keys'));
      return;
    }

    setAudioState({ url: '', status: 'loading' });
    try {
      const res = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ voice, model, text: scene.prose }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'TTS failed' }));
        throw new Error(err.error || `TTS failed (${res.status})`);
      }
      const blob = await res.blob();
      const reader = new FileReader();
      const audioUrl: string = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      dispatch({ type: 'SET_SCENE_AUDIO', sceneId: scene.id, audioUrl });
      setAudioState({ url: audioUrl, status: 'ready' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAudioState({ url: '', status: 'error', error: message });
    }
  }, [narrative, scene, access, dispatch]);

  const clearAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioState({ url: '', status: 'idle' });
    dispatch({ type: 'CLEAR_SCENE_AUDIO', sceneId: scene.id });
  }, [scene.id, dispatch]);

  // Listen for palette events
  useEffect(() => {
    function onGenerate() { generateAudio(); }
    function onClear() { clearAudio(); }
    window.addEventListener('canvas:generate-audio', onGenerate);
    window.addEventListener('canvas:clear-audio', onClear);
    return () => {
      window.removeEventListener('canvas:generate-audio', onGenerate);
      window.removeEventListener('canvas:clear-audio', onClear);
    };
  }, [generateAudio, clearAudio]);

  const togglePlay = useCallback(async () => {
    if (!audioState.url || audioState.status !== 'ready') return;

    // Pause if playing
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Resume if paused
    if (audioRef.current && !isPlaying) {
      try { await audioRef.current.play(); setIsPlaying(true); } catch { /* ignore */ }
      return;
    }

    // Convert data URL to blob URL for reliable playback
    let playUrl = audioState.url;
    if (audioState.url.startsWith('data:')) {
      try {
        const res = await fetch(audioState.url);
        const blob = await res.blob();
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        playUrl = URL.createObjectURL(blob);
        blobUrlRef.current = playUrl;
      } catch { /* fall back to data URL */ }
    }

    const audio = new Audio(playUrl);
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => { setIsPlaying(false); setCurrentTime(0); };
    try { await audio.play(); } catch { /* ignore */ }
    audioRef.current = audio;
    setIsPlaying(true);
  }, [audioState, isPlaying]);

  const seek = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audioRef.current) {
      audioRef.current.currentTime = pct * duration;
    }
    setCurrentTime(pct * duration);
  }, [duration]);

  // Draw waveform — full width, vertically centered
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;
    const bars = Math.floor(w / 6);
    const barW = 3;
    const gap = (w - bars * barW) / Math.max(1, bars - 1);
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, w, h);

    // Deterministic waveform from scene id
    const seed = scene.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < bars; i++) {
      const n1 = Math.sin(seed * 0.1 + i * 0.7) * 0.3;
      const n2 = Math.sin(seed * 0.3 + i * 1.3) * 0.25;
      const n3 = Math.sin(i * 0.4 + seed * 0.05) * 0.15;
      const n4 = Math.cos(i * 0.2 + seed * 0.15) * 0.1;
      const amplitude = Math.max(0.06, Math.min(0.95, n1 + n2 + n3 + n4 + 0.4));
      const barH = amplitude * h * 0.85;
      const x = i * (barW + gap);
      const played = i / bars < progress;

      if (played) {
        ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      }
      ctx.beginPath();
      ctx.roundRect(x, mid - barH / 2, barW, barH, 1.5);
      ctx.fill();
    }
  }, [currentTime, duration, scene.id, audioState.status]);

  // Resize observer for canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      // Trigger redraw by updating a dummy state
      setCurrentTime((t) => t);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const hasAudio = audioState.status === 'ready';
  const isLoading = audioState.status === 'loading';
  const hasError = audioState.status === 'error';
  const hasProse = !!scene.prose;
  const hasVoice = !!narrative.storySettings?.audioVoice;

  return (
    <div ref={containerRef} className="h-full flex flex-col items-center justify-center px-8">

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-violet-500/20 border-t-violet-400 rounded-full animate-spin" />
          <p className="text-[11px] text-text-dim">Generating audio...</p>
        </div>
      )}

      {/* Error */}
      {hasError && (
        <div className="text-center">
          <p className="text-[11px] text-red-400/80 mb-3">{audioState.error}</p>
          <button onClick={() => void generateAudio()} className="text-[10px] px-4 py-1.5 rounded-full border border-white/10 text-text-dim hover:text-text-secondary transition">Retry</button>
        </div>
      )}

      {/* Audio player — full width waveform */}
      {hasAudio && !isLoading && (
        <div className="w-full max-w-4xl flex flex-col items-center gap-6">
          <canvas
            ref={canvasRef}
            className="w-full cursor-pointer"
            style={{ height: '20vh' }}
            onClick={seek}
          />
          <div className="flex items-center gap-5">
            <span className="text-[11px] text-text-dim font-mono tabular-nums w-12 text-right">{formatTime(currentTime)}</span>
            <button
              onClick={togglePlay}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                isPlaying
                  ? 'bg-violet-500/25 text-violet-300 ring-2 ring-violet-500/25'
                  : 'bg-white/10 text-text-primary hover:bg-white/15'
              }`}
            >
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="6,3 20,12 6,21" /></svg>
              )}
            </button>
            <span className="text-[11px] text-text-dim font-mono tabular-nums w-12">{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Empty states */}
      {!hasAudio && !isLoading && !hasError && (
        <div className="flex flex-col items-center gap-3">
          {!hasVoice ? (
            <>
              <p className="text-[11px] text-text-dim">No voice configured.</p>
              <button onClick={() => window.dispatchEvent(new CustomEvent('open-story-settings'))}
                className="text-[10px] text-violet-400/80 hover:text-violet-400 transition">
                Open Story Settings
              </button>
            </>
          ) : !hasProse ? (
            <>
              <p className="text-[11px] text-text-dim">Generate prose first, then create audio.</p>
              <button onClick={() => dispatch({ type: 'SET_GRAPH_VIEW_MODE', mode: 'prose' })}
                className="text-[10px] text-emerald-400/80 hover:text-emerald-400 transition">
                Switch to Prose &rarr;
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-text-dim">No audio for this scene yet.</p>
              <p className="text-[10px] text-text-dim/40">Use the palette below to generate audio.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
