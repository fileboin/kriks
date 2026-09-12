import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { LISTING_KIND, parseListing, type Listing } from '@/lib/listings';

/** Fetch the public listings feed, optionally filtered by category (relay-level `#t` filter). */
export function useListings(category: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<Listing[]>({
    queryKey: ['listings', 'feed', category ?? 'all'],
    queryFn: async (c) => {
      const events = await nostr.query(
        [
          category
            ? { kinds: [LISTING_KIND], limit: 200, '#t': [category] }
            : { kinds: [LISTING_KIND], limit: 200 },
        ],
        { signal: c.signal },
      );

      return events
        .map(parseListing)
        .filter((listing): listing is Listing => listing !== null)
        .sort((a, b) => b.publishedAt - a.publishedAt);
    },
    staleTime: 60_000,
  });
}

/** Fetch all listings published by a specific user (for "My listings"). */
export function useUserListings(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<Listing[]>({
    queryKey: ['listings', 'user', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const events = await nostr.query(
        [{ kinds: [LISTING_KIND], authors: [pubkey], limit: 100 }],
        { signal: c.signal },
      );

      return events
        .map(parseListing)
        .filter((listing): listing is Listing => listing !== null)
        .sort((a, b) => b.publishedAt - a.publishedAt);
    },
    enabled: pubkey !== undefined,
    staleTime: 30_000,
  });
}

/** Fetch a single listing by author pubkey + `d` identifier (addressable coordinates). */
export function useListing(pubkey: string, identifier: string) {
  const { nostr } = useNostr();

  return useQuery<Listing | null>({
    queryKey: ['listings', 'detail', pubkey, identifier],
    queryFn: async (c) => {
      // Filtering on `authors` is required — the `d` tag alone is not a trust boundary
      // for addressable events, and pubkey+kind+d identifies the exact event.
      const [event] = await nostr.query(
        [{ kinds: [LISTING_KIND], authors: [pubkey], '#d': [identifier], limit: 1 }],
        { signal: c.signal },
      );

      if (!event) return null;
      return parseListing(event);
    },
    staleTime: 30_000,
  });
}
