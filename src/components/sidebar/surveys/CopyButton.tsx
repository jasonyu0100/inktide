"use client";

import { useState } from "react";
import { copyToClipboard } from "@/lib/research-export";

/** Copy-to-clipboard button with a brief "Copied" confirmation. */
export function CopyButton({
  getText,
  label = "Copy",
  className,
}: {
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const ok = await copyToClipboard(getText());
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      onClick={onClick}
      className={
        className ??
        "text-[10px] px-2 py-1 rounded text-text-dim hover:text-text-primary hover:bg-white/5 transition-colors"
      }
      title="Copy as Markdown"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
