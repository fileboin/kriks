import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { NostrEvent } from '@nostrify/nostrify';

import { SponsoredCard } from './SponsoredCard';
import { parseCampaignEvent, type AdCampaign } from '@/lib/sponsored/core';
import { SPONSORED_CAMPAIGN_KIND } from '@/lib/sponsored/kinds';
import type { Listing } from '@/lib/listings';

/* Fixtures — campaigns are built through the REAL SP1 parser (no duplicates). */

const ADMIN = 'aa'.repeat(32);
const ADMINS = [ADMIN];
const SELLER = 'bb'.repeat(32);

function event(tags: string[][]): NostrEvent {
  return {
    kind: SPONSORED_CAMPAIGN_KIND,
    id: 'e'.padEnd(64, '1'),
    pubkey: ADMIN,
    created_at: 1_699_000_000,
    sig: 's'.padEnd(128, '0'),
    content: '',
    tags,
  };
}

function promoCampaign(): AdCampaign {
  const campaign = parseCampaignEvent(
    event([
      ['d', 'promo-x'],
      ['type', 'promo'],
      ['title', 'Lightning wallet iz snova'],
      ['image', 'https://img.example.com/banner.png'],
      ['url', 'https://example.com/promo'],
      ['cta', 'Probaj ga'],
      ['description', 'Najbolji wallet za sats'],
      ['price', '50000', 'sats'],
      ['duration', '14'],
      ['start', '1699999000'],
      ['end', '1999999999'],
      ['status', 'active'],
      ['accent', 'amber'],
      ['badge', 'promo'],
    ]),
    ADMINS,
  );
  if (!campaign) throw new Error('fixture campaign failed to parse');
  return campaign;
}

function listingCampaign(): AdCampaign {
  const campaign = parseCampaignEvent(
    event([
      ['d', 'listing-x'],
      ['type', 'sponsored-listing'],
      ['a', `30402:${SELLER}:iphone-13`],
      ['price', '21000', 'sats'],
      ['duration', '7'],
      ['start', '1699999000'],
      ['end', '1999999999'],
      ['status', 'active'],
    ]),
    ADMINS,
  );
  if (!campaign) throw new Error('fixture campaign failed to parse');
  return campaign;
}

function fakeListing(overrides?: Partial<Listing>): Listing {
  return {
    event: {} as NostrEvent,
    pubkey: SELLER,
    d: 'iphone-13',
    title: 'iPhone 13, 128GB — odlično stanje',
    status: 'active',
    publishedAt: 1_700_000_000,
    images: ['https://img.example.com/iphone.png'],
    categories: ['telefoni'],
    price: { amount: 95000, currency: 'RSD' },
    ...overrides,
  };
}

describe('SponsoredCard — promo', () => {
  it('renders title, CTA label, description and badge', () => {
    render(<SponsoredCard campaign={promoCampaign()} />);

    expect(screen.getByText('Lightning wallet iz snova')).toBeInTheDocument();
    expect(screen.getByText('Probaj ga')).toBeInTheDocument();
    expect(screen.getByText('Najbolji wallet za sats')).toBeInTheDocument();
    expect(screen.getByText('Promovisano')).toBeInTheDocument();
  });

  it('links the whole card externally with safe rel attributes', () => {
    render(<SponsoredCard campaign={promoCampaign()} />);

    const link = screen.getByRole('link', { name: /lightning wallet iz snova/i });
    expect(link).toHaveAttribute('href', 'https://example.com/promo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows the promo domain as the source label', () => {
    render(<SponsoredCard campaign={promoCampaign()} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('applies the configured accent as the left border', () => {
    const { container } = render(<SponsoredCard campaign={promoCampaign()} />);
    expect(container.firstElementChild?.className).toContain('border-l-amber-500');
  });
});

describe('SponsoredCard — sponsored listing', () => {
  it('renders the promoted listing data: category, title, price', () => {
    render(<SponsoredCard campaign={listingCampaign()} listing={fakeListing()} />);

    expect(screen.getByText('Telefoni')).toBeInTheDocument();
    expect(screen.getByText('iPhone 13, 128GB — odlično stanje')).toBeInTheDocument();
    expect(screen.getByText(/RSD/).textContent).toContain('95');
    expect(screen.getByText('Istaknuto')).toBeInTheDocument();
  });

  it('links to the listing detail (internal)', () => {
    render(<SponsoredCard campaign={listingCampaign()} listing={fakeListing()} />);

    const link = screen.getByRole('link', { name: /iphone 13/i });
    expect(link.getAttribute('href')).toMatch(/^\/naddr1/);
    expect(link).not.toHaveAttribute('target');
  });

  it('renders the category placeholder when the listing has no image', () => {
    render(
      <SponsoredCard campaign={listingCampaign()} listing={fakeListing({ images: [] })} />,
    );
    // Title still renders; no <img> in the card.
    expect(screen.getByText('iPhone 13, 128GB — odlično stanje')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a BTC price with the bolt treatment', () => {
    render(
      <SponsoredCard
        campaign={listingCampaign()}
        listing={fakeListing({ price: { amount: 0.001, currency: 'BTC' } })}
      />,
    );
    expect(screen.getByText(/BTC/).textContent).toMatch(/0[.,]001/);
  });
});
