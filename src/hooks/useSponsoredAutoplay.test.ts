import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useSponsoredAutoplay, MIN_SLIDE_INTERVAL_MS } from './useSponsoredAutoplay';

describe('useSponsoredAutoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not advance while disabled', () => {
    const onAdvance = vi.fn();
    renderHook(() =>
      useSponsoredAutoplay({ enabled: false, intervalMs: 6000, onAdvance }),
    );

    vi.advanceTimersByTime(60_000);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('advances exactly on the configured interval', () => {
    const onAdvance = vi.fn();
    renderHook(() =>
      useSponsoredAutoplay({ enabled: true, intervalMs: 6000, onAdvance }),
    );

    vi.advanceTimersByTime(5999);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(12_000);
    expect(onAdvance).toHaveBeenCalledTimes(3);
  });

  it('always invokes the latest onAdvance callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useSponsoredAutoplay({ enabled: true, intervalMs: 1000, onAdvance: cb }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });
    vi.advanceTimersByTime(MIN_SLIDE_INTERVAL_MS);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('enforces the 3-second anti-flicker floor', () => {
    const onAdvance = vi.fn();
    renderHook(() =>
      useSponsoredAutoplay({ enabled: true, intervalMs: 500, onAdvance }),
    );

    vi.advanceTimersByTime(2999);
    expect(onAdvance).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('stops advancing after unmount', () => {
    const onAdvance = vi.fn();
    const { unmount } = renderHook(() =>
      useSponsoredAutoplay({ enabled: true, intervalMs: 4000, onAdvance }),
    );

    unmount();
    vi.advanceTimersByTime(60_000);
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
