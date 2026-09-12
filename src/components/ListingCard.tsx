import { useRef, useState, type LucideIcon, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';

import { EscrowCreateDialog, type EscrowPreset } from '@/components/escrow/EscrowCreateDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { escrowPath, shortNpub } from '@/lib/escrow/core';
import type { EscrowState, EscrowStatus } from '@/lib/escrow/types';
import {
  CATEGORY_LABELS,
  LISTING_KIND,
  formatPrice,
  listingPath,
  sanitizeUrl,
  timeAgo,
  type Listing,
} from '@/lib/listings';
import { cn } from '@/lib/utils';

import {
  Armchair,
  Bitcoin,
  Briefcase,
  Car,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Cpu,
  CreditCard,
  Dumbbell,
  Gift,
  Home,
  Laptop,
  MapPin,
  MessageSquare,
  Package,
  PawPrint,
  ShieldCheck,
  Shirt,
  Smartphone,
  Wrench,
  Zap,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   Bro-style category system: color + icon per category.
   Placeholder = category color @15% bg + category icon (28px).
   Label       = category color, tiny bold uppercase.
   ──────────────────────────────────────────────────────────── */

interface CategoryStyle {
  icon: LucideIcon;
  text: string;
  bg: string;
  iconColor: string;
}

const CATEGORY_STYLES = new Map<string, CategoryStyle>([
  ['telefoni', { icon: Smartphone, text: 'text-sky-400', bg: 'bg-sky-500/15', iconColor: 'text-sky-500/60' }],
  ['sim-esim', { icon: CreditCard, text: 'text-teal-400', bg: 'bg-teal-500/15', iconColor: 'text-teal-500/60' }],
  ['sms-otp', { icon: MessageSquare, text: 'text-violet-400', bg: 'bg-violet-500/15', iconColor: 'text-violet-500/60' }],
  ['racunari', { icon: Laptop, text: 'text-blue-400', bg: 'bg-blue-500/15', iconColor: 'text-blue-500/60' }],
  ['elektronika', { icon: Cpu, text: 'text-cyan-400', bg: 'bg-cyan-500/15', iconColor: 'text-cyan-500/60' }],
  ['kripto', { icon: Bitcoin, text: 'text-amber-400', bg: 'bg-amber-500/15', iconColor: 'text-amber-500/60' }],
  ['vozila', { icon: Car, text: 'text-red-400', bg: 'bg-red-500/15', iconColor: 'text-red-500/60' }],
  ['nekretnine', { icon: Home, text: 'text-emerald-400', bg: 'bg-emerald-500/15', iconColor: 'text-emerald-500/60' }],
  ['namestaj', { icon: Armchair, text: 'text-orange-400', bg: 'bg-orange-500/15', iconColor: 'text-orange-500/60' }],
  ['odeca', { icon: Shirt, text: 'text-pink-400', bg: 'bg-pink-500/15', iconColor: 'text-pink-500/60' }],
  ['sport', { icon: Dumbbell, text: 'text-lime-400', bg: 'bg-lime-500/15', iconColor: 'text-lime-500/60' }],
  ['ljubimci', { icon: PawPrint, text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', iconColor: 'text-fuchsia-500/60' }],
  ['usluge', { icon: Wrench, text: 'text-indigo-400', bg: 'bg-indigo-500/15', iconColor: 'text-indigo-500/60' }],
  ['saas-projekti', { icon: Cloud, text: 'text-violet-400', bg: 'bg-violet-500/15', iconColor: 'text-violet-500/60' }],
  ['posao', { icon: Briefcase, text: 'text-teal-400', bg: 'bg-teal-500/15', iconColor: 'text-teal-500/60' }],
  ['besplatno', { icon: Gift, text: 'text-green-400', bg: 'bg-green-500/15', iconColor: 'text-green-500/60' }],
  ['ostalo', { icon: Package, text: 'text-slate-400', bg: 'bg-slate-500/15', iconColor: 'text-slate-500/60' }],
]);

const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  icon: Package,
  text: 'text-slate-400',
  bg: 'bg-slate-500/15',
  iconColor: 'text-slate-500/60',
};

function getCategoryStyle(value: string | undefined): CategoryStyle {
  return (value && CATEGORY_STYLES.get(value)) || DEFAULT_CATEGORY_STYLE;
}

/** Compact escrow status chip label. */
const SHORT_ESCROW_STATUS: Record<EscrowStatus, string> = {
  proposed: 'Predlog',
  active: 'Aktivno',
  funded: 'Uplaćeno',
  delivered: 'Isporučeno',
  released: 'Završeno',
  refunded: 'Refund',
  disputed: 'Spor',
  cancelling: 'Otkaz…',
  cancelled: 'Otkazano',
  declined: 'Odbijeno',
  expired: 'Isteklo',
};

function SellerName({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const name = metadata?.display_name ?? metadata?.name;
  const picture = metadata?.picture ? sanitizeUrl(metadata.picture) : undefined;
  const label = name ?? shortNpub(pubkey);
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <span className="flex min-w-0 items-center gap-1">
      <Avatar className="size-3.5">
        {picture && <AvatarImage src={picture} alt="" />}
        <AvatarFallback className="text-[8px] leading-none">{initial}</AvatarFallback>
      </Avatar>
      <span className="truncate">{label}</span>
    </span>
  );
}

export interface ListingCardProps {
  listing: Listing;
  /** The viewer's escrow for this listing (if any) — links to its status. */
  myEscrowState?: EscrowState;
  className?: string;
}

export function ListingCard({ listing, myEscrowState, className }: ListingCardProps) {
  const { user } = useCurrentUser();
  const [imageIndex, setImageIndex] = useState(0);
  const [escrowOpen, setEscrowOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const category = listing.categories[0];
  const style = getCategoryStyle(category);
  const isSold = listing.status === 'sold';
  const images = listing.images;
  const hasControls = images.length > 1;

  // Bro price treatment: crypto (BTC) → amber + bolt; fiat → green; no price → muted.
  const isBtc = listing.price?.currency.toUpperCase() === 'BTC';

  const isOwner = user?.pubkey === listing.pubkey;
  const escrowAllowed = !isOwner && !isSold && !myEscrowState;

  const listingCoordinate = `${LISTING_KIND}:${listing.pubkey}:${listing.d}`;
  const escrowPreset: EscrowPreset = {
    adapterId: 'goods',
    terms: {
      title: listing.title,
      price: listing.price ? String(listing.price.amount) : '',
      currency: listing.price?.currency ?? 'RSD',
    },
    counterpartyPubkey: listing.pubkey,
    counterpartyLabel: 'Prodavac iz oglasa',
    myRole: 'buyer',
    listingCoordinate,
  };

  const clampIndex = (index: number) => Math.min(Math.max(index, 0), images.length - 1);

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !hasControls) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      setImageIndex((i) => clampIndex(i + (dx < 0 ? 1 : -1)));
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[10px] border bg-card transition-colors hover:border-primary/40',
        className,
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Full-card click target (Bro InkWell behavior) */}
      <Link
        to={listingPath(listing)}
        className="absolute inset-0 z-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={`${listing.title} — ${formatPrice(listing.price)}`}
      />

      {/* ── Image / slideshow (fixed 80px banner, Bro proportions) ── */}
      <div className="relative h-20 w-full shrink-0 overflow-hidden bg-muted">
        {images.length > 0 ? (
          <div
            className="flex h-full w-full transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${imageIndex * 100}%)` }}
          >
            {images.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={i === 0 ? listing.title : `Slika ${i + 1} — ${listing.title}`}
                loading="lazy"
                draggable={false}
                className={cn(
                  'h-full w-full shrink-0 object-cover',
                  isSold && 'opacity-70 grayscale',
                )}
              />
            ))}
          </div>
        ) : (
          // Bro-style category placeholder: category color @15% + category icon
          <div className={cn('flex h-full w-full items-center justify-center', style.bg)}>
            <style.icon className={cn('size-7', style.iconColor)} aria-hidden />
          </div>
        )}

        {isSold && (
          <span className="absolute top-1.5 left-1.5 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-destructive-foreground uppercase">
            Prodato
          </span>
        )}

        {hasControls && (
          <>
            {/* Multi-image indicator */}
            <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1 py-px text-[9px] font-medium text-white tabular-nums">
              {imageIndex + 1}/{images.length}
            </span>
            {/* Desktop prev/next (hover) */}
            <button
              type="button"
              aria-label="Prethodna slika"
              onClick={() => setImageIndex((i) => clampIndex(i - 1))}
              disabled={imageIndex === 0}
              className="absolute top-1/2 left-1 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0 max-md:hidden"
            >
              <ChevronLeft className="size-3" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Sledeća slika"
              onClick={() => setImageIndex((i) => clampIndex(i + 1))}
              disabled={imageIndex === images.length - 1}
              className="absolute top-1/2 right-1 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0 max-md:hidden"
            >
              <ChevronRight className="size-3" aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* ── Content (pointer-events pass through to the link; buttons opt back in) ── */}
      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-1 p-1.5">
        {/* ① Category label */}
        <p className={cn('truncate text-[10px] font-bold tracking-wide uppercase', style.text)}>
          {CATEGORY_LABELS.get(category) ?? category}
        </p>

        {/* ② Title */}
        <p className="line-clamp-2 text-xs font-bold leading-tight">{listing.title}</p>

        {/* ③ Spacer — price anchors to the bottom (Bro layout) */}
        <div className="mt-auto" />

        {/* ④ Price */}
        <p
          className={cn(
            'flex items-center gap-0.5 truncate font-bold',
            isBtc
              ? 'text-xs text-amber-400'
              : listing.price
                ? 'text-xs text-green-400'
                : 'text-[10px] font-medium text-muted-foreground',
          )}
        >
          {isBtc && <Zap className="size-3 shrink-0 text-amber-400" aria-hidden />}
          {formatPrice(listing.price)}
        </p>

        {/* ⑤ Metadata: location · time */}
        <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          <MapPin className="size-2.5 shrink-0" aria-hidden />
          <span className="truncate">{listing.location ?? 'Lokacija nije navedena'}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{timeAgo(listing.publishedAt)}</span>
        </p>

        {/* ⑥ Seller + escrow entry */}
        <div className="flex items-center justify-between gap-1">
          <span className="min-w-0 flex-1 text-[10px] text-muted-foreground">
            <SellerName pubkey={listing.pubkey} />
          </span>

          <span className="pointer-events-auto shrink-0">
            {myEscrowState ? (
              <Link
                to={escrowPath(myEscrowState.contract)}
                title={`Escrow status: ${myEscrowState.status}`}
                className="inline-flex items-center gap-0.5 rounded border border-primary/40 px-1.5 py-0.5 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ShieldCheck className="size-2.5" aria-hidden />
                {SHORT_ESCROW_STATUS[myEscrowState.status]}
              </Link>
            ) : (
              escrowAllowed && (
                <button
                  type="button"
                  onClick={() => setEscrowOpen(true)}
                  className="inline-flex items-center gap-0.5 rounded border border-primary/40 px-1.5 py-0.5 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ShieldCheck className="size-2.5" aria-hidden />
                  Escrow
                </button>
              )
            )}
          </span>
        </div>
      </div>

      <EscrowCreateDialog open={escrowOpen} onOpenChange={setEscrowOpen} preset={escrowPreset} />
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[10px] border bg-card" aria-hidden>
      <div className="h-20 w-full animate-pulse bg-muted/60" />
      <div className="space-y-1.5 p-1.5">
        <div className="h-2 w-14 animate-pulse rounded bg-muted/60" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/60" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-muted/60" />
        <div className="mt-1 h-3 w-1/2 animate-pulse rounded bg-muted/60" />
        <div className="h-2 w-3/4 animate-pulse rounded bg-muted/60" />
        <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}
