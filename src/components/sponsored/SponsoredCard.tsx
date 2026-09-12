import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Zap } from 'lucide-react';

import type { AdCampaign } from '@/lib/sponsored/core';
import { getCategoryStyle } from '@/lib/categoryStyles';
import {
  CATEGORY_LABELS,
  formatPrice,
  listingPath,
  type Listing,
} from '@/lib/listings';
import { cn } from '@/lib/utils';

/**
 * Landscape sponsored card — same marketplace visual language as ListingCard
 * (flat, rounded-[10px], thin border, category/title/price hierarchy) but
 * horizontal: image left, content right, ISTAKNUTO badge, discrete primary
 * left-border accent. NOT a ListingCard.
 */

const BADGE_LABELS: Record<AdCampaign['badge'], string> = {
  featured: 'Istaknuto',
  promo: 'Promovisano',
  new: 'Novo',
};

const ACCENT_CLASSES: Record<AdCampaign['accent'], string> = {
  primary: 'border-l-primary',
  amber: 'border-l-amber-500',
  green: 'border-l-green-500',
};

function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export interface SponsoredCardProps {
  campaign: AdCampaign;
  /** Loaded listing for `sponsored-listing` campaigns. */
  listing?: Listing;
  className?: string;
  style?: CSSProperties;
}

export function SponsoredCard({ campaign, listing, className, style }: SponsoredCardProps) {
  const isSponsoredListing = campaign.type === 'sponsored-listing';
  const promo = campaign.promo;

  // Title: listing title for sponsored-listing, promo title otherwise.
  const title = isSponsoredListing ? listing?.title : promo?.title;
  const category = isSponsoredListing ? listing?.categories[0] : undefined;
  const categoryStyle = getCategoryStyle(category);
  const categoryLabel = isSponsoredListing
    ? (category ? (CATEGORY_LABELS.get(category) ?? category) : undefined)
    : domainOf(promo?.url ?? '');

  // Price display comes from the promoted LISTING (never the campaign price).
  const isBtc = listing?.price?.currency.toUpperCase() === 'BTC';

  const linkLabel = title
    ? `${title} — sponzorisano`
    : 'Sponzorisana kampanja';

  return (
    <div
      style={style}
      className={cn(
        // Fixed 160px height — premium promo size, zero layout shift.
        'relative flex h-40 overflow-hidden rounded-[10px] border border-border border-l-2 bg-card',
        ACCENT_CLASSES[campaign.accent],
        className,
      )}
    >
      {/* Full-card click target (internal listing / external promo CTA) */}
      {isSponsoredListing && listing ? (
        <Link
          to={listingPath(listing)}
          aria-label={linkLabel}
          className="absolute inset-0 z-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ) : promo ? (
        <a
          href={promo.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${linkLabel} (${domainOf(promo.url)})`}
          className="absolute inset-0 z-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ) : null}

      {/* Image zone (left, 96px mobile / 128px desktop) */}
      <div className="relative h-full w-24 shrink-0 overflow-hidden bg-muted sm:w-32">
        {isSponsoredListing ? (
          listing?.images[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              loading="lazy"
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <div className={cn('flex size-full items-center justify-center', categoryStyle.bg)}>
              <categoryStyle.icon className={cn('size-7', categoryStyle.iconColor)} aria-hidden />
            </div>
          )
        ) : promo ? (
          <img
            src={promo.image}
            alt={promo.title}
            loading="lazy"
            draggable={false}
            className="size-full object-cover"
          />
        ) : null}
      </div>

      {/* Content zone (right) — pointer-events pass through to the link */}
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
        {/* ① Source row: category (listing) / domain (promo) + badge */}
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'min-w-0 truncate text-[11px] font-bold tracking-wide uppercase',
              isSponsoredListing ? categoryStyle.text : 'text-muted-foreground',
            )}
          >
            {categoryLabel ?? '—'}
          </p>
          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
            {BADGE_LABELS[campaign.badge]}
          </span>
        </div>

        {/* ② Title */}
        {title && <p className="line-clamp-2 text-sm font-bold leading-snug">{title}</p>}

        {/* ③ Bottom: price (listing) / description (promo) + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2">
          {isSponsoredListing ? (
            <>
              <p
                className={cn(
                  'flex min-w-0 items-center gap-0.5 truncate text-sm font-bold',
                  listing?.price
                    ? isBtc
                      ? 'text-amber-400'
                      : 'text-green-400'
                    : 'text-[11px] font-medium text-muted-foreground',
                )}
              >
                {isBtc && <Zap className="size-3.5 shrink-0 text-amber-400" aria-hidden />}
                {formatPrice(listing?.price)}
              </p>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </>
          ) : promo ? (
            <>
              <p className="min-w-0 truncate text-[11px] text-muted-foreground">
                {promo.description ?? domainOf(promo.url)}
              </p>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {promo.ctaLabel}
                <ExternalLink className="size-3" aria-hidden />
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Skeleton with the same landscape proportions (while a listing loads). */
export function SponsoredCardSkeleton({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={style}
      aria-hidden
      className="flex h-40 overflow-hidden rounded-[10px] border border-border border-l-2 border-l-primary/40 bg-card"
    >
      <div className="h-full w-24 shrink-0 animate-pulse bg-muted/60 sm:w-32" />
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-muted/60" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted/60" />
        <div className="mt-auto h-3.5 w-1/2 animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}
