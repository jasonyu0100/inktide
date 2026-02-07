'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type MediaItem = {
  id: string;
  imageUrl: string;
  label: string;
  sublabel?: string;
  aspectClass: string; // e.g. 'aspect-[3/4]' or 'aspect-video'
};

type Props = {
  items: MediaItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
};

export default function MediaPreview({ items, currentIndex, onNavigate, onClose }: Props) {
  const item = items[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  if (!item) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/10 text-white/60 hover:text-white hover:bg-black/80 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>

        {/* Image */}
        <img
          src={item.imageUrl}
          alt={item.label}
          className="rounded-xl object-contain max-h-[75vh] max-w-[85vw] border border-white/10 shadow-2xl"
        />

        {/* Caption */}
        <div className="mt-3 text-center">
          <p className="text-sm text-white/90 font-medium">{item.label}</p>
          {item.sublabel && (
            <p className="text-[11px] text-white/40 mt-0.5">{item.sublabel}</p>
          )}
        </div>

        {/* Counter */}
        <p className="text-[10px] text-white/30 mt-1">
          {currentIndex + 1} / {items.length}
        </p>

        {/* Navigation arrows */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:bg-black/70 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3L5 7l4 4" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            onClick={goNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:bg-black/70 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3l4 4-4 4" />
            </svg>
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
