import { useMemo } from 'react';

import { SponsoredSlider } from './SponsoredSlider';
import { useSponsoredCampaigns, useSponsoredSliderSettings } from '@/hooks/useSponsoredCampaigns';
import { getVisibleCampaigns } from '@/lib/sponsored/core';

/**
 * Sponsored section container — the only Index.tsx insertion point.
 *
 * Data comes exclusively from SP1: admin-author-filtered hooks + core
 * validation (invalid/disabled/expired campaigns never reach the slider —
 * getVisibleCampaigns applies the SP1 rules). No visible campaigns → the
 * section renders nothing at all (no empty space).
 */
export function SponsoredSection() {
  const { data: campaigns } = useSponsoredCampaigns();
  const { settings } = useSponsoredSliderSettings();

  const visible = useMemo(() => getVisibleCampaigns(campaigns ?? []), [campaigns]);

  if (visible.length === 0) return null;

  return (
    <section className="mt-6" aria-label="Sponzorisano">
      <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        Promovisano
      </p>
      <SponsoredSlider campaigns={visible} settings={settings} />
    </section>
  );
}
