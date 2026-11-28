"use client";

import Link from "next/link";
import { ArrowLeft, Download, Info, Send, Sparkles, X } from "lucide-react";

export interface ClipsHeroBannerProps {
  clipCount: number;
  selectedCount: number;
  busy: boolean;
  notice?: string;
  onClearNotice?: () => void;
  onExportSelected: () => void;
  onPublishSelected: () => void;
}

export function ClipsHeroBanner({
  clipCount,
  selectedCount,
  busy,
  notice,
  onClearNotice,
  onExportSelected,
  onPublishSelected,
}: ClipsHeroBannerProps) {
  return (
    <section className="ca-clips-hero ca-glass">
      <div className="ca-clips-hero-content !flex-col !items-center !text-center gap-5">
        {/* Top Row: Back to Source Videos (Unikorns UX) + Ready Pill */}
        <div className="w-full flex items-center justify-between gap-3">
          <Link
            href="/videos"
            className="ca-clips-link-btn group transition-transform hover:-translate-x-0.5"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
            <span>Source videos</span>
          </Link>

          <div className="ca-clips-eyebrow !mb-0">
            <Sparkles size={13} />
            <span>AI-Created Shorts · {clipCount} ready</span>
          </div>
        </div>

        {/* Centered Editorial Title & Subtitle */}
        <div className="ca-clips-hero-text !max-w-xl mx-auto flex flex-col items-center">
          <h1 className="ca-clips-headline">
            Your AI-Created <em>Shorts Collection</em>
          </h1>

          <p className="ca-clips-subtext !mx-auto">
            Every short here was intelligently found, scored, and crafted by our AI engine.
            Hover any card to preview, or select to export and publish.
          </p>
        </div>

        {/* Centered Action Pills */}
        <div className="ca-clips-actions-cluster !justify-center">
          <button
            type="button"
            className="ca-clips-action-btn transition-transform active:scale-95"
            disabled={selectedCount === 0 || busy}
            onClick={onExportSelected}
          >
            <Download size={14} />
            <span>Export selected ({selectedCount})</span>
          </button>

          <button
            type="button"
            className="ca-clips-action-btn ca-btn-primary transition-transform active:scale-95"
            disabled={selectedCount === 0 || busy}
            onClick={onPublishSelected}
          >
            <Send size={14} />
            <span>Publish Selected ({selectedCount})</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="ca-notice-banner ca-glass">
          <div className="ca-notice-content">
            <Info size={16} className="ca-notice-icon" />
            <span className="ca-notice-text">{notice}</span>
          </div>
          {onClearNotice && (
            <button
              type="button"
              className="ca-notice-close"
              onClick={onClearNotice}
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
