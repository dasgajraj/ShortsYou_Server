"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const STRIP_COUNT = 12;
const STRIP_STAGGER = 0.028;
const STRIP_DURATION = 0.52;
const STRIP_BASE_DELAY = 0.05;
// Ensure parent outlives the final strip (0.05 + 11 * 0.028 + 0.52 = 0.878s) so nothing pops on unmount
const EXIT_HOLD_DURATION =
  STRIP_BASE_DELAY + (STRIP_COUNT - 1) * STRIP_STAGGER + STRIP_DURATION + 0.04;

const SMOOTH_OUT_EASE = [0.22, 1, 0.36, 1] as const;

export function SplashScreen() {
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [showWordmark, setShowWordmark] = useState(false);
  const [wordmarkShift, setWordmarkShift] = useState(0);
  const wordmarkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wordmarkTimer = setTimeout(() => {
      if (wordmarkRef.current) {
        setWordmarkShift((wordmarkRef.current.offsetWidth + 14) / 2);
      }
      setShowWordmark(true);
    }, 420);

    // Pre-fetch core platform APIs in parallel during splash animation
    const prefetchAll = async () => {
      const token = localStorage.getItem("shortsyou_jwt");
      if (!token) return;
      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: ["auth", "me"],
          queryFn: () => api.me(token),
        }),
        queryClient.prefetchQuery({
          queryKey: ["videos", "list"],
          queryFn: () => api.videos(token),
        }),
        queryClient.prefetchQuery({
          queryKey: ["clips", "list"],
          queryFn: () => api.clips(token),
        }),
        queryClient.prefetchQuery({
          queryKey: ["analytics", "performance"],
          queryFn: () => api.analytics.performance(token),
        }),
      ]);
    };

    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 1750));
    const maxCap = new Promise<void>((resolve) => setTimeout(resolve, 2600));

    let cancelled = false;
    Promise.race([
      Promise.all([minDelay, prefetchAll()]),
      maxCap,
    ]).then(() => {
      if (!cancelled) setVisible(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(wordmarkTimer);
    };
  }, [queryClient]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="shortsyou-splash"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 1,
            pointerEvents: "none",
            transition: {
              duration: prefersReducedMotion ? 0.25 : EXIT_HOLD_DURATION,
            },
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center select-none overflow-hidden pointer-events-auto"
          aria-label="Loading ShortsYou"
        >
          {/* GPU-composited staggered vertical strips for a silky left-to-right outgoing dissolve */}
          <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
            {Array.from({ length: STRIP_COUNT }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0, transition: { duration: 0.2 } }
                    : {
                        opacity: 0,
                        transition: {
                          duration: STRIP_DURATION,
                          delay: STRIP_BASE_DELAY + i * STRIP_STAGGER,
                          ease: SMOOTH_OUT_EASE,
                        },
                      }
                }
                style={{ willChange: "opacity", transform: "translateZ(0)" }}
                className="h-full w-full bg-[#06070a]"
              />
            ))}
          </div>

          {/* Centered Brand Mark & Wordmark (pure transform + opacity, zero layout reflow) */}
          <motion.div
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              x: showWordmark ? -wordmarkShift : 0,
              transition: { duration: 0.48, ease: SMOOTH_OUT_EASE },
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: -6,
              transition: { duration: 0.36, ease: SMOOTH_OUT_EASE },
            }}
            style={{ willChange: "transform, opacity" }}
            className="relative z-10 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.42, ease: SMOOTH_OUT_EASE }}
              style={{ willChange: "transform, opacity" }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-[10px] bg-white text-[#06070a] flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] shrink-0"
            >
              <motion.svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="currentColor"
                initial={{ scale: 0.4, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ delay: 0.16, duration: 0.4, ease: SMOOTH_OUT_EASE }}
                style={{ willChange: "transform, opacity" }}
              >
                <circle cx="8" cy="8" r="4.2" />
                <circle cx="16" cy="8" r="4.2" />
                <circle cx="8" cy="16" r="4.2" />
                <circle cx="16" cy="16" r="4.2" />
              </motion.svg>
            </motion.div>

            <motion.div
              ref={wordmarkRef}
              initial={{
                opacity: 0,
                x: -10,
                clipPath: "inset(0 100% 0 0)",
              }}
              animate={
                showWordmark
                  ? {
                      opacity: 1,
                      x: 0,
                      clipPath: "inset(0 0% 0 0)",
                    }
                  : {
                      opacity: 0,
                      x: -10,
                      clipPath: "inset(0 100% 0 0)",
                    }
              }
              transition={{ duration: 0.48, ease: SMOOTH_OUT_EASE }}
              style={{ willChange: "transform, opacity, clip-path" }}
              className="absolute left-full ml-[14px] whitespace-nowrap pointer-events-none"
            >
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Shorts<span className="text-white/75 font-medium">You</span>
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
