import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { SponsoredCard, SponsoredCardSkeleton } from './SponsoredCard';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useSponsoredAutoplay } from '@/hooks/useSponsoredAutoplay';
import { useListing } from '@/hooks/useListings';
import type { AdCampaign, SliderSettings } from '@/lib/sponsored/core';
import { cn } from '@/lib/utils';

/**
 * Slide width per effective visible count (gap 12px). Full literal classes
 * so the Tailwind compiler generates every variant. Applied in steps:
 * mobile 1 visible (calc(100%−48px) peek), sm ≤2 visible, lg = effective.
 */
const WIDTH_CLASSES: Record<number, { sm: string; lg: string }> = {
  1: {
    sm: 'sm:[--sponsor-w:100%]',
    lg: 'lg:[--sponsor-w:100%]',
  },
  2: {
    sm: 'sm:[--sponsor-w:calc((100%-12px)/2)]',
    lg: 'lg:[--sponsor-w:calc((100%-12px)/2)]',
  },
  3: {
    sm: 'sm:[--sponsor-w:calc((100%-12px)/2)]',
    lg: 'lg:[--sponsor-w:calc((100%-24px)/3)]',
  },
};

/**
 * Effective visible count (desktop): a lone campaign fills the row as one
 * big card (never a duplicated or missing second slot); otherwise the
 * smaller of the campaign count and the configured desktop count.
 */
export function getEffectiveVisibleCount(campaignCount: number, desktopAds: number): number {
  if (campaignCount <= 1) return 1;
  return Math.min(campaignCount, desktopAds);
}

/** Dots are only useful for a small number of positions. */
const MAX_DOTS = 10;

/** Pure rotation gate — unit-tested separately. */
export function shouldAutoRotate(
  settings: SliderSettings,
  prefersReducedMotion: boolean,
  snapCount: number,
): boolean {
  return settings.autoRotate && !prefersReducedMotion && snapCount > 1;
}

/** Loads the promoted listing for a sponsored-listing campaign. */
function SponsoredListingSlide({
  campaign,
}: {
  campaign: AdCampaign;
}) {
  // Coordinate is validated in SP1 core: "30402:<pubkey>:<d>".
  const [, pubkey, identifier] = (campaign.listingCoordinate ?? '').split(':');
  const { data: listing, isPending } = useListing(pubkey, identifier);

  if (isPending) return <SponsoredCardSkeleton />;
  // Listing deleted/unreachable → skip the card entirely (no broken ads).
  if (!listing) return null;

  return <SponsoredCard campaign={campaign} listing={listing} />;
}

export interface SponsoredSliderProps {
  /** Visible campaigns only (getVisibleCampaigns — SP1 core rules). */
  campaigns: AdCampaign[];
  settings: SliderSettings;
}

export function SponsoredSlider({ campaigns, settings }: SponsoredSliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    loop: false,
  });

  const [snapCount, setSnapCount] = useState(1);
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);

  const prefersReducedMotion = usePrefersReducedMotion();

  const paused = interactionPaused || documentHidden;
  const rotate = shouldAutoRotate(settings, prefersReducedMotion, snapCount);

  const advance = useCallback(() => {
    if (!emblaApi) return;
    const snaps = emblaApi.scrollSnapList();
    const current = emblaApi.selectedScrollSnap();
    if (current >= snaps.length - 1) {
      emblaApi.scrollTo(0);
    } else {
      emblaApi.scrollNext();
    }
  }, [emblaApi]);

  useSponsoredAutoplay({
    enabled: rotate && !paused,
    intervalMs: settings.secondsPerSlide * 1000,
    onAdvance: advance,
  });

  // Sync state from embla (select/reInit) + pause while dragging.
  useEffect(() => {
    if (!emblaApi) return;

    const sync = () => {
      setSnapCount(emblaApi.scrollSnapList().length);
      setSelected(emblaApi.selectedScrollSnap());
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };

    const onPointerDown = () => setInteractionPaused(true);

    emblaApi.on('select', sync);
    emblaApi.on('reInit', sync);
    emblaApi.on('pointerDown', onPointerDown);
    sync();

    return () => {
      emblaApi.off('select', sync);
      emblaApi.off('reInit', sync);
      emblaApi.off('pointerDown', onPointerDown);
    };
  }, [emblaApi]);

  // Pause while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => setDocumentHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (campaigns.length === 0) return null;

  const effectiveN = getEffectiveVisibleCount(campaigns.length, settings.desktopAds);
  const width = WIDTH_CLASSES[effectiveN] ?? WIDTH_CLASSES[3];
  const showDots = snapCount > 1 && snapCount <= MAX_DOTS;

  return (
    <div
      className={cn(
        'group relative [--sponsor-w:calc(100%-48px)]',
        width.sm,
        width.lg,
      )}
      onPointerEnter={() => setInteractionPaused(true)}
      onPointerLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={() => setInteractionPaused(false)}
      role="region"
      aria-label="Sponzorisane kampanje — slajder"
    >
      {/* Track */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.event.id}
              className="flex-none"
              style={{ width: 'var(--sponsor-w)' }}
            >
              {campaign.type === 'sponsored-listing' ? (
                <SponsoredListingSlide campaign={campaign} />
              ) : (
                <SponsoredCard campaign={campaign} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Desktop arrows (hover) */}
      <button
        type="button"
        aria-label="Prethodna kampanja"
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!canPrev}
        className={cn(
          'absolute top-1/2 left-1 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white',
          'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:hidden',
          !canPrev && 'pointer-events-none opacity-0',
        )}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Sledeća kampanja"
        onClick={() => emblaApi?.scrollNext()}
        disabled={!canNext}
        className={cn(
          'absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white',
          'opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:hidden',
          !canNext && 'pointer-events-none opacity-0',
        )}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>

      {/* Position dots (only when a small number of positions) */}
      {showDots && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {Array.from({ length: snapCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Kampanja ${i + 1} od ${snapCount}`}
              aria-current={i === selected}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'size-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                i === selected ? 'bg-primary' : 'bg-border hover:bg-muted-foreground/40',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
