"use client";
/* External creator and Supabase assets are intentionally rendered without Next's image proxy. */
/* eslint-disable @next/next/no-img-element */

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  Check,
  Loader2,
  Play,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import type { Clip, Video } from "@/lib/api";
import { formatDuration } from "@/lib/formatters";
import { ImageGeneration, type ImageGenerationStatus } from "@/components/agents/image-generation";

const RENDER_STEPS = [
  "Fetching source video…",
  "Transcribing audio…",
  "Analyzing viral moments…",
  "Generating hook & captions…",
  "Editing & framing 9:16…",
  "Rendering 4K short…",
  "Finalizing & syncing…",
];

export interface ClipCardProps {
  clip: Clip;
  video?: Video;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onExport: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onPreview?: (clip: Clip) => void;
  index: number;
}

export const ClipCard = memo(function ClipCard({
  clip,
  video,
  selected,
  busy,
  onSelect,
  onExport,
  onDownload,
  onDelete,
  onPreview,
  index,
}: ClipCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const image =
    clip.selectedThumbnail || clip.thumbnailOptions?.[0] || video?.thumbnailUrl;
  const title =
    clip.originalHook ||
    clip.selectedHook ||
    clip.transcriptText ||
    "High-saliency moment";

  const isRendered =
    ["exported", "published"].includes(clip.status) || Boolean(clip.supabaseShortUrl);
  const isRendering = ["editing", "queued", "processing"].includes(clip.status);

  const [renderProgress, setRenderProgress] = useState(10);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!isRendering) return;
    const durationMs = 255 * 1000;
    const startedAt = clip.createdAt
      ? new Date(clip.createdAt).getTime()
      : Date.now();
    const update = () => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      const pct = Math.min(95, Math.max(4, Math.round((elapsed / durationMs) * 95)));
      setRenderProgress(pct);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRendering, clip.createdAt]);

  const stepIndex = Math.min(
    RENDER_STEPS.length - 1,
    Math.floor((renderProgress / 100) * RENDER_STEPS.length)
  );

  const genStatus: ImageGenerationStatus = !isRendering
    ? "complete"
    : renderProgress < 20
    ? "queued"
    : renderProgress < 75
    ? "generating"
    : "refining";

  const score =
    typeof clip.viralScore === "number"
      ? clip.viralScore > 1
        ? Math.round(clip.viralScore)
        : Math.round(clip.viralScore * 100)
      : 0;

  const handleMouseEnter = () => {
    setHovered(true);
    if (videoRef.current) {
      void videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative aspect-[9/15] w-full rounded-[22px] overflow-hidden bg-slate-950 border transition-all duration-300 shadow-sm hover:shadow-xl ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500/40"
          : "border-slate-200/80 hover:border-slate-300"
      }`}
    >
      {/* Full-bleed Media / Blur Generation Animation */}
      <div
        onClick={() => onPreview && onPreview(clip)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPreview?.(clip);
          }
        }}
        className="absolute inset-0 cursor-pointer"
        title={isRendered ? "Click to preview short" : "Click to view details"}
      >
        {isRendering ? (
          <div className="absolute inset-0 z-10">
            <ImageGeneration
              status={genStatus}
              progress={renderProgress}
              size="fluid"
              aspectRatio="9 / 15"
              resolution=""
              interactive
              showStatus={false}
              className="size-full"
              mediaClassName="size-full rounded-none border-0"
            >
              {image ? (
                <img src={image} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <div className={`ca-clip-art-fallback art-${index % 4}`}>
                  <Sparkles size={28} />
                </div>
              )}
            </ImageGeneration>
          </div>
        ) : clip.supabaseShortUrl ? (
          <>
            {image && !hovered && (
              <img
                src={image}
                alt=""
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            )}
            <video
              ref={videoRef}
              src={clip.supabaseShortUrl}
              poster={image}
              muted
              loop
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                hovered || !image ? "opacity-100" : "opacity-0 absolute inset-0"
              }`}
            />
          </>
        ) : image ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className={`ca-clip-art-fallback art-${index % 4}`}>
            <Play size={28} />
          </div>
        )}

        {/* Top & Bottom Scrims */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/95 via-black/55 to-transparent z-20" />
      </div>

      {/* Unikorns-style Top Row: Left Circular Badge/Checkbox + Right Frosted Pill */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <label
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto h-8 w-8 rounded-full flex items-center justify-center border backdrop-blur-md cursor-pointer transition-all ${
            selected
              ? "bg-indigo-600 border-indigo-400 text-white shadow-md"
              : "bg-black/45 border-white/25 text-white/90 hover:bg-black/65"
          }`}
          title={selected ? "Deselect short" : "Select short"}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="sr-only"
          />
          {selected ? <Check size={14} strokeWidth={3} /> : <Sparkles size={13} />}
        </label>

        <div className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white tabular-nums">
          <span>{formatDuration(clip.durationSeconds ?? 0)}</span>
          {score > 0 && (
            <>
              <span className="text-white/40">·</span>
              <span className="text-amber-300 font-semibold">{score}%</span>
            </>
          )}
        </div>
      </div>

      {/* Bottom Content & Actions */}
      <div className="absolute inset-x-0 bottom-0 z-30 p-3.5 flex flex-col gap-2.5">
        <div
          onClick={() => onPreview && onPreview(clip)}
          className="cursor-pointer flex flex-col gap-1"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-white/75">
            <span className="truncate max-w-[140px]">
              {video?.title ?? "Processed source"}
            </span>
            <span>·</span>
            <span
              className={
                isRendered
                  ? "text-emerald-300 font-semibold"
                  : isRendering
                  ? "text-amber-300 font-semibold"
                  : "text-white/80"
              }
            >
              {isRendering ? RENDER_STEPS[stepIndex] : isRendered ? "Ready" : clip.status}
            </span>
          </div>

          <h3
            className="text-[13px] font-semibold leading-snug text-white line-clamp-2"
            title={title}
          >
            {title}
          </h3>
        </div>

        {/* Tactile Frosted Glass Action Row (matching upper navbar) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 pt-0.5"
        >
          <button
            type="button"
            onClick={onExport}
            disabled={busy || isRendering}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold bg-[#b6c2d0] hover:bg-[#c3cedc] text-[#1a2032] border border-white/30 shadow-[inset_0_2px_4px_rgba(60,75,95,0.25),inset_0_-1.5px_2px_rgba(255,255,255,0.65),0_1px_1px_rgba(255,255,255,0.4)] disabled:opacity-55 transition-all cursor-pointer"
          >
            {busy || isRendering ? (
              <Loader2 className="animate-spin" size={12} />
            ) : (
              <WandSparkles size={12} />
            )}
            <span>
              {isRendering ? "Rendering…" : isRendered ? "Re-render" : "Create"}
            </span>
          </button>

          <button
            type="button"
            onClick={onDownload}
            disabled={busy || !isRendered}
            title={isRendered ? "Download vertical MP4" : "Render short before downloading"}
            className="ca-glass-circle-btn !w-8 !h-8 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowDownToLine size={13} />
          </button>

          <Link
            href={`/editor/${clip.videoId}`}
            title="Open in Studio Timeline Editor"
            className="ca-glass-circle-btn !w-8 !h-8 shrink-0"
          >
            <SlidersHorizontal size={13} />
          </Link>

          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete clip"
            title="Delete clip"
            className="ca-glass-circle-btn !w-8 !h-8 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Full-Width Progress Stroke Attached to Card Bottom */}
      {isRendering && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 h-[3px] bg-white/15">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 transition-all duration-700 ease-out"
            style={{ width: `${renderProgress}%` }}
          />
        </div>
      )}
    </motion.article>
  );
});
