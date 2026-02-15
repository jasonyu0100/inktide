'use client';

import { useState } from 'react';

export function CollapsibleSection({ title, count, defaultOpen = false, children }: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 group"
      >
        <svg
          className={`w-2.5 h-2.5 text-text-dim transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5l10 7-10 7z" />
        </svg>
        <h3 className="text-[10px] uppercase tracking-widest text-text-dim group-hover:text-text-secondary transition-colors">
          {title}
        </h3>
        <span className="text-[9px] text-text-dim/50 font-mono">{count}</span>
      </button>
      {open && children}
    </div>
  );
}
