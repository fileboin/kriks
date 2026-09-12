import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

import { ADMIN_PUBKEYS, hasAdminPubkeys } from '@/lib/admin';
import {
  DEFAULT_SLIDER_SETTINGS,
  parseCampaignEvent,
  parseSettingsEvent,
  sortCampaigns,
  type AdCampaign,
  type SliderSettings,
} from '@/lib/sponsored/core';
import {
  SPONSORED_CAMPAIGN_KIND,
  SPONSORED_SETTINGS_D,
  SPONSORED_SETTINGS_KIND,
} from '@/lib/sponsored/kinds';

/**
 * Sponsored campaigns from the relays (SP1 — data layer only, no UI).
 *
 * Only admin-signed kind 35239 events are queried (authors filter at the
 * relay) and accepted (authorization re-check at parse — defense in depth).
 * With no admin pubkeys configured the hook stays disabled: the fail-safe
 * state renders nothing.
 */
export function useSponsoredCampaigns() {
  const { nostr } = useNostr();
  const adminsKey = ADMIN_PUBKEYS.join(',');

  return useQuery<AdCampaign[]>({
    queryKey: ['sponsored', 'campaigns', adminsKey],
    queryFn: async (c) => {
      const events = await nostr.query(
        [
          {
            kinds: [SPONSORED_CAMPAIGN_KIND],
            // Trust boundary — addressable events require an author filter.
            authors: [...ADMIN_PUBKEYS],
            limit: 100,
          },
        ],
        { signal: c.signal },
      );

      return events
        .map((event) => parseCampaignEvent(event))
        .filter((campaign): campaign is AdCampaign => campaign !== null)
        .sort(sortCampaigns);
    },
    enabled: hasAdminPubkeys(),
    staleTime: 60_000,
  });
}

/**
 * Slider settings singleton (kind 37197, admin-signed, d = "slider").
 * `settings` always carries safe values: published admin settings or the
 * locked defaults until then (and when no admins are configured at all).
 */
export function useSponsoredSliderSettings() {
  const { nostr } = useNostr();
  const adminsKey = ADMIN_PUBKEYS.join(',');

  const query = useQuery<SliderSettings | null>({
    queryKey: ['sponsored', 'settings', adminsKey],
    queryFn: async (c) => {
      const [event] = await nostr.query(
        [
          {
            kinds: [SPONSORED_SETTINGS_KIND],
            authors: [...ADMIN_PUBKEYS],
            '#d': [SPONSORED_SETTINGS_D],
            limit: 1,
          },
        ],
        { signal: c.signal },
      );

      return event ? parseSettingsEvent(event) : null;
    },
    enabled: hasAdminPubkeys(),
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    settings: query.data ?? DEFAULT_SLIDER_SETTINGS,
  };
}
