import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_LABELS, formatPrice, listingPath, timeAgo, type Listing } from '@/lib/listings';
import { cn } from '@/lib/utils';

import { ImageIcon, MapPin } from 'lucide-react';

export interface ListingCardProps {
  listing: Listing;
  className?: string;
}

export function ListingCard({ listing, className }: ListingCardProps) {
  const image = listing.images[0];
  const category = listing.categories[0];
  const isSold = listing.status === 'sold';

  return (
    <Link
      to={listingPath(listing)}
      className={cn(
        'group rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
        className,
      )}
      aria-label={`${listing.title} — ${formatPrice(listing.price)}`}
    >
      <Card className="h-full overflow-hidden py-0 gap-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
          {image ? (
            <img
              src={image}
              alt={listing.title}
              loading="lazy"
              className={cn(
                'size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none',
                isSold && 'opacity-70 grayscale',
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground/50">
              <ImageIcon className="size-10" aria-hidden />
            </div>
          )}

          {isSold && (
            <Badge
              variant="destructive"
              className="absolute top-3 left-3 rounded-full uppercase tracking-wide"
            >
              Prodato
            </Badge>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
            {listing.title}
          </p>

          <p className="text-lg font-bold tracking-tight">{formatPrice(listing.price)}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{listing.location ?? 'Lokacija nije navedena'}</span>
            </span>
            <span className="shrink-0">{timeAgo(listing.publishedAt)}</span>
          </div>

          {category && (
            <Badge variant="secondary" className="mt-1 w-fit rounded-full text-xs font-medium">
              {CATEGORY_LABELS.get(category) ?? category}
            </Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function ListingCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden py-0 gap-0" aria-hidden>
      <div className="aspect-[4/3] shrink-0 bg-muted/60 animate-pulse" />
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="h-5 w-4/5 rounded bg-muted/60 animate-pulse" />
        <div className="h-6 w-1/2 rounded bg-muted/60 animate-pulse" />
        <div className="h-3.5 w-2/3 rounded bg-muted/60 animate-pulse" />
      </CardContent>
    </Card>
  );
}
