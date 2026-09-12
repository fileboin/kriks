import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { NostrEvent } from '@nostrify/nostrify';

import { SponsoredSlider, getEffectiveVisibleCount, shouldAutoRotate } from './SponsoredSlider';
import { parseCampaignEvent, DEFAULT_SLIDER_SETTINGS, type AdCampaign, type SliderSettings } from '@/lib/sponsored/core';
import { SPONSORED_CAMPAIGN_KIND } from '@/lib/sponsored/kinds';

const ADMIN = 'aa'.repeat(32);
const ADMINS = [ADMIN];

function promoEvent(id: string): NostrEvent {
  return {
    kind: SPONSORED_CAMPAIGN_KIND,
    id: id.padEnd(64, '0'),
    pubkey: ADMIN,
    created_at: 1_699_000_000,
    sig: 's'.padEnd(128, '0'),
    content: '',
    tags: [
      ['d', id],
      ['type', 'promo'],
      ['title', `Promo kampanja ${id}`],
      ['image', `https://img.example.com/${id}.png`],
      ['url', 'https://example.com'],
      ['price', '1000', 'sats'],
      ['duration', '7'],
      ['start', '1699999000'],
      ['end', '1999999999'],
      ['status', 'active'],
    ],
  };
}

function campaigns(count: number): AdCampaign[] {
  return Array.from({ length: count }, (_, i) => {
    const campaign = parseCampaignEvent(promoEvent(`k${i}`), ADMINS);
    if (!campaign) throw new Error('fixture failed');
    return campaign;
  });
}

describe('shouldAutoRotate (pure gate)', () => {
  const settings: SliderSettings = { ...DEFAULT_SLIDER_SETTINGS };

  it('rotates when enabled, no reduced motion, multiple snaps', () => {
    expect(shouldAutoRotate(settings, false, 3)).toBe(true);
  });

  it('never rotates with reduced motion', () => {
    expect(shouldAutoRotate(settings, true, 3)).toBe(false);
  });

  it('never rotates when autoRotate is off or there is a single snap', () => {
    expect(shouldAutoRotate({ ...settings, autoRotate: false }, false, 3)).toBe(false);
    expect(shouldAutoRotate(settings, false, 1)).toBe(false);
  });
});

describe('getEffectiveVisibleCount (row fill rule)', () => {
  it('a lone campaign fills the row as one big card', () => {
    expect(getEffectiveVisibleCount(1, 3)).toBe(1);
  });

  it('two campaigns fill the row with 2 cards (no empty third slot)', () => {
    expect(getEffectiveVisibleCount(2, 3)).toBe(2);
  });

  it('3+ campaigns use the configured desktop count', () => {
    expect(getEffectiveVisibleCount(3, 3)).toBe(3);
    expect(getEffectiveVisibleCount(7, 3)).toBe(3);
  });

  it('respects a smaller configured count', () => {
    expect(getEffectiveVisibleCount(3, 1)).toBe(1);
    expect(getEffectiveVisibleCount(5, 2)).toBe(2);
  });
});

describe('SponsoredSlider (rendering)', () => {
  it('renders nothing without campaigns (no empty space)', () => {
    const { container } = render(
      <SponsoredSlider campaigns={[]} settings={DEFAULT_SLIDER_SETTINGS} />,
    );
    expect(container.firstElementChild).toBeNull();
  });

  it('renders one card per campaign', () => {
    render(<SponsoredSlider campaigns={campaigns(3)} settings={DEFAULT_SLIDER_SETTINGS} />);

    expect(screen_titles().length).toBe(3);
  });

  it('renders a single campaign without dots', () => {
    const { container } = render(
      <SponsoredSlider campaigns={campaigns(1)} settings={DEFAULT_SLIDER_SETTINGS} />,
    );
    expect(screen_titles().length).toBe(1);
    // No position dots for a single slide.
    expect(container.querySelectorAll('button[aria-label^="Kampanja"]').length).toBe(0);
  });
});

function screen_titles(): HTMLElement[] {
  // Titles are the promo card headings.
  return Array.from(document.querySelectorAll('p.line-clamp-2'));
}
