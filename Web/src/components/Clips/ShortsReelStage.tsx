"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
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

export interface ShortsReelStageProps {
  clips: Clip[];
  videoMap: Map<string, Video>;
  selectedIds: string[];
  busyId: string;
  onToggleSelect: (id: string) => void;
  onExport: (id: string) => void;
  onDownload: (id: string) => void;
  onDelete: (clip: Clip) => void;
  onPreview: (clip: Clip) => void;
}

export function ShortsReelStage({
  clips,
  videoMap,
  selectedIds,
  busyId,
  onToggleSelect,
  onExport,
  onDownload,
  onDelete,
  onPreview,
}: ShortsReelStageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [renderProgress, setRenderProgress] = useState(12);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const safeIndex = clips.length > 0 ? Math.min(activeIndex, clips.length - 1) : 0;
  const activeClip = clips[safeIndex];

  const isActiveRendering = activeClip
    ? ["editing", "queued", "processing"].includes(activeClip.status)
    : false;

  useEffect(() => {
    if (!isActiveRendering || !activeClip) return;
    const durationMs = 255 * 1000;
    const startedAt = activeClip.createdAt
      ? new Date(activeClip.createdAt).getTime()
      : Date.now();
    const update = () => {
      const elapsed = Math.max(0, Date.now() - startedAt);
      const pct = Math.min(95, Math.max(4, Math.round((elapsed / durationMs) * 95)));
      setRenderProgress(pct);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActiveRendering, activeClip]);

  const goPrev = useCallback(() => {
    setPaused(false);
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : clips.length - 1));
  }, [clips.length]);

  const goNext = useCallback(() => {
    setPaused(false);
    setActiveIndex((prev) => (prev < clips.length - 1 ? prev + 1 : 0));
  }, [clips.length]);

  const handleTogglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }, []);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (clips.length <= 1) return;
      if (info.offset.x < -55 || info.velocity.x < -300) {
        goNext();
      } else if (info.offset.x > 55 || info.velocity.x > 300) {
        goPrev();
      }
    },
    [clips.length, goNext, goPrev]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  if (!activeClip) return null;

  const prevClip = clips.length > 1 ? clips[(safeIndex - 1 + clips.length) % clips.length] : null;
  const nextClip = clips.length > 1 ? clips[(safeIndex + 1) % clips.length] : null;

  const renderPreviewCard = (clip: Clip, position: "prev" | "active" | "next") => {
    const video = videoMap.get(clip.videoId);
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
    const isBusy = busyId === clip.id;
    const isSelected = selectedIds.includes(clip.id);
    const score =
      typeof clip.viralScore === "number"
        ? clip.viralScore > 1
          ? Math.round(clip.viralScore)
          : Math.round(clip.viralScore * 100)
        : 0;

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

    if (position !== "active") {
      return (
        <motion.button
          key={`${position}-${clip.id}`}
          type="button"
          whileHover={{ scale: 0.94, opacity: 0.9 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => (position === "prev" ? goPrev() : goNext())}
          className="hidden lg:flex relative w-[225px] aspect-[9/16] rounded-[24px] overflow-hidden border border-slate-200/80 bg-slate-900 shadow-md opacity-55 scale-90 transition-opacity duration-300 shrink-0 text-left group cursor-pointer"
          aria-label={`View ${position === "prev" ? "previous" : "next"} short`}
        >
          {isRendering ? (
            <div className="absolute inset-0">
              <ImageGeneration
                status="generating"
                progress={45}
                size="fluid"
                aspectRatio="9 / 16"
                resolution=""
                showStatus={false}
                className="size-full"
                mediaClassName="size-full rounded-none border-0"
              >
                {image ? (
                  <img src={image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950" />
                )}
              </ImageGeneration>
            </div>
          ) : image ? (
            <img
              src={image}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white/40">
              <Play size={28} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 text-white backdrop-blur-md mb-1.5">
              {clip.category || "Viral"}
            </span>
            <p className="text-xs font-semibold text-white line-clamp-2">{title}</p>
          </div>
        </motion.button>
      );
    }

    return (
      <motion.div
        key={clip.id}
        drag={clips.length > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="relative w-full max-w-[360px] aspect-[9/16] rounded-[28px] overflow-hidden border border-slate-200/90 bg-slate-950 shadow-2xl shrink-0 cursor-grab active:cursor-grabbing select-none"
      >
        {/* Story Progress Bars */}
        <div className="absolute top-3 left-4 right-4 z-30 flex items-center gap-1">
          {clips.slice(0, Math.min(clips.length, 12)).map((c, idx) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setPaused(false);
                setActiveIndex(idx);
              }}
              aria-label={`Go to short ${idx + 1}`}
              className="h-1 flex-1 rounded-full overflow-hidden bg-white/25 transition-all"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  idx === safeIndex
                    ? "w-full bg-white"
                    : idx < safeIndex
                    ? "w-full bg-white/70"
                    : "w-0"
                }`}
              />
            </button>
          ))}
        </div>

        {/* Video, Blur Generation Animation, or Poster */}
        {isRendering ? (
          <div className="absolute inset-0 z-10">
            <ImageGeneration
              status={genStatus}
              progress={renderProgress}
              size="fluid"
              aspectRatio="9 / 16"
              resolution=""
              interactive
              showStatus={false}
              className="size-full"
              mediaClassName="size-full rounded-none border-0"
            >
              {image ? (
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white/40">
                  <Sparkles size={34} />
                </div>
              )}
            </ImageGeneration>
          </div>
        ) : clip.supabaseShortUrl ? (
          <>
            <video
              ref={videoRef}
              key={clip.supabaseShortUrl}
              src={clip.supabaseShortUrl}
              poster={image}
              autoPlay
              loop
              muted={muted}
              playsInline
              onClick={handleTogglePlay}
              className="w-full h-full object-cover cursor-pointer"
            />
            {paused && (
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label="Resume playback"
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/25"
              >
                <span className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                  <Play size={24} />
                </span>
              </button>
            )}
          </>
        ) : image ? (
          <img
            src={image}
            alt=""
            onClick={() => onPreview(clip)}
            className="w-full h-full object-cover cursor-pointer"
          />
        ) : (
          <div
            onClick={() => onPreview(clip)}
            className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white/40 cursor-pointer"
          >
            <Play size={40} />
          </div>
        )}

        {/* Top & Bottom Gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/90 via-black/45 to-transparent z-20" />

        {/* Top Bar Controls */}
        <div className="absolute top-7 left-4 right-4 z-30 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onToggleSelect(clip.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border transition-colors ${
              isSelected
                ? "bg-indigo-600 text-white border-indigo-400"
                : "bg-black/40 text-white/90 border-white/20 hover:bg-black/60"
            }`}
          >
            {isSelected ? "Selected ✓" : "Select"}
          </button>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400/95 text-slate-950 shadow-sm">
              <Sparkles size={11} />
              <span>{score}%</span>
            </span>
            {clip.supabaseShortUrl && !isRendering && (
              <>
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  aria-label={paused ? "Play short" : "Pause short"}
                  className="h-7 w-7 rounded-full bg-black/45 hover:bg-black/65 text-white border border-white/20 flex items-center justify-center backdrop-blur-md"
                >
                  {paused ? <Play size={12} /> : <Pause size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute short" : "Mute short"}
                  className="h-7 w-7 rounded-full bg-black/45 hover:bg-black/65 text-white border border-white/20 flex items-center justify-center backdrop-blur-md"
                >
                  {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Floating Action Rail */}
        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={() => onPreview(clip)}
            title="Preview Short"
            className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-105"
          >
            <Play size={16} />
          </button>

          <Link
            href={`/editor/${clip.videoId}`}
            title="Open in Studio Editor"
            className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-105"
          >
            <SlidersHorizontal size={16} />
          </Link>

          <button
            type="button"
            onClick={() => onExport(clip.id)}
            disabled={isBusy || isRendering}
            title={isRendered ? "Re-render Short" : "Create Short"}
            className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-50 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-105"
          >
            {isBusy || isRendering ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <WandSparkles size={16} />
            )}
          </button>

          <button
            type="button"
            onClick={() => onDownload(clip.id)}
            disabled={isBusy || !isRendered}
            title={isRendered ? "Download MP4" : "Render short first"}
            className="h-10 w-10 rounded-full bg-emerald-500/85 hover:bg-emerald-500 disabled:opacity-40 text-white border border-emerald-300/40 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-105"
          >
            <ArrowDownToLine size={16} />
          </button>

          <button
            type="button"
            onClick={() => onDelete(clip)}
            disabled={isBusy}
            title="Delete Short"
            className="h-10 w-10 rounded-full bg-rose-500/75 hover:bg-rose-500 disabled:opacity-40 text-white border border-rose-300/40 backdrop-blur-md flex items-center justify-center transition-transform hover:scale-105"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Bottom Metadata & Live Generation Progress Overlay */}
        <div className="absolute left-4 right-16 bottom-5 z-30 flex flex-col gap-2 text-white">
          {isRendering && (
            <div className="rounded-xl bg-black/55 backdrop-blur-md border border-white/15 px-3 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className="font-medium text-white truncate">
                  {RENDER_STEPS[stepIndex]}
                </span>
                <span className="font-bold text-amber-300 tabular-nums shrink-0">
                  {renderProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-all duration-700 ease-out"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-white/80">
            <span className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md font-medium truncate max-w-[160px]">
              {video?.title ?? "Source Video"}
            </span>
            <span className="tabular-nums">
              {formatDuration(clip.durationSeconds ?? 0)}
            </span>
          </div>

          <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-white">
            {title}
          </h3>

          <div className="flex items-center gap-2 text-[11px] text-white/75">
            <span
              className={`font-semibold ${
                isRendered
                  ? "text-emerald-300"
                  : isRendering
                  ? "text-amber-300"
                  : "text-white/80"
              }`}
            >
              {isRendering ? "AI rendering…" : isRendered ? "Ready to Download" : clip.status}
            </span>
            <span>·</span>
            <span>{clip.category || "Viral"}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <section
      aria-label="AI-Created Shorts Reel"
      className="ca-glass rounded-3xl border border-slate-200/80 p-4 sm:p-6 flex flex-col items-center gap-5"
    >
      {/* Top Counter & Navigation */}
      <div className="w-full flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-600">
          Short <span className="font-bold text-slate-900">{safeIndex + 1}</span> of{" "}
          <span className="font-bold text-slate-900">{clips.length}</span>
          <span className="hidden sm:inline text-slate-400 ml-2">
            · Drag card or use arrow keys
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={clips.length <= 1}
            aria-label="Previous short"
            className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={clips.length <= 1}
            aria-label="Next short"
            className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 3-Card Interactive Vertical Shorts Stage */}
      <div className="w-full flex items-center justify-center gap-6 py-1">
        {prevClip && renderPreviewCard(prevClip, "prev")}
        <AnimatePresence mode="wait">
          {renderPreviewCard(activeClip, "active")}
        </AnimatePresence>
        {nextClip && renderPreviewCard(nextClip, "next")}
      </div>

      {/* Interactive Quick-Jump Thumbnail Strip */}
      {clips.length > 1 && (
        <div className="w-full flex items-center justify-center gap-2 overflow-x-auto py-1 px-2">
          {clips.slice(0, 14).map((c, idx) => {
            const thumb =
              c.selectedThumbnail ||
              c.thumbnailOptions?.[0] ||
              videoMap.get(c.videoId)?.thumbnailUrl;
            const isCurrent = idx === safeIndex;
            const rendering = ["editing", "queued", "processing"].includes(c.status);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setPaused(false);
                  setActiveIndex(idx);
                }}
                aria-label={`Select short ${idx + 1}`}
                className={`relative w-10 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                  isCurrent
                    ? "border-slate-900 scale-110 shadow-md"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className={`w-full h-full object-cover ${rendering ? "blur-[2px]" : ""}`}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800" />
                )}
                {rendering && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <Loader2 size={12} className="text-amber-300 animate-spin" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
