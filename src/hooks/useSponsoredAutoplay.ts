import { useEffect, useRef } from 'react';

/** Hard floor for slide duration — anti-flicker (mirrors SP1 settings bounds). */
export const MIN_SLIDE_INTERVAL_MS = 3000;

export interface UseSponsoredAutoplayOptions {
  /** Rotation only when enabled (settings + reduced-motion + interactivity). */
  enabled: boolean;
  /** Slide interval in ms — clamped to the 3 s minimum. */
  intervalMs: number;
  /** Advances the slider; always the latest callback is invoked. */
  onAdvance: () => void;
}

/**
 * Sponsored slider auto-rotation timer. Pure interval logic — the slider
 * decides *whether* to rotate (settings, reduced motion, pause state), this
 * hook only handles *when*.
 */
export function useSponsoredAutoplay({
  enabled,
  intervalMs,
  onAdvance,
}: UseSponsoredAutoplayOptions): void {
  const advanceRef = useRef(onAdvance);

  useEffect(() => {
    advanceRef.current = onAdvance;
  }, [onAdvance]);

  const safeIntervalMs = Math.max(MIN_SLIDE_INTERVAL_MS, intervalMs);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(() => advanceRef.current(), safeIntervalMs);
    return () => clearInterval(id);
  }, [enabled, safeIntervalMs]);
}
