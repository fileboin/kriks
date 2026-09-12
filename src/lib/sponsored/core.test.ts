import { describe, it, expect } from 'vitest';

import type { NostrEvent } from '@nostrify/nostrify';

import { ADMIN_PUBKEYS } from '@/lib/admin';

import {
  campaignPath,
  getVisibleCampaigns,
  isCampaignVisible,
  parseCampaignEvent,
  parseSettingsEvent,
  sortCampaigns,
  DEFAULT_SLIDER_SETTINGS,
  type AdCampaign,
} from './core';
import { SPONSORED_CAMPAIGN_KIND, SPONSORED_SETTINGS_D, SPONSORED_SETTINGS_KIND } from './kinds';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const ADMIN = 'aa'.repeat(32);
const OTHER = 'bb'.repeat(32);
const ADMINS = [ADMIN];
const LISTING_COORD = `30402:${OTHER}:neki-oglas`;
const NOW = 1_700_000_000;

function campaignEvent(overrides?: {
  pubkey?: string;
  tags?: string[][];
  kind?: number;
  content?: string;
}): NostrEvent {
  return {
    kind: overrides?.kind ?? SPONSORED_CAMPAIGN_KIND,
    id: 'c'.padEnd(64, '0'),
    pubkey: overrides?.pubkey ?? ADMIN,
    created_at: 1_699_000_000,
    sig: 's'.padEnd(128, '0'),
    content: overrides?.content ?? '',
    tags: overrides?.tags ?? [
      ['d', 'kampanja-1'],
      ['type', 'sponsored-listing'],
      ['a', LISTING_COORD],
      ['price', '21000', 'sats'],
      ['duration', '7'],
      ['start', '1699999000'],
      ['end', '1700003600'],
      ['status', 'active'],
      ['priority', '5'],
      ['alt', 'Sponzorisana kampanja: test'],
    ],
  };
}

function promoEvent(tags: string[][]): NostrEvent {
  return campaignEvent({
    tags: [
      ['d', 'promo-1'],
      ['type', 'promo'],
      ['title', 'Najbolji Lightning wallet'],
      ['image', 'https://img.example.com/banner.png'],
      ['url', 'https://example.com'],
      ['cta', 'Probaj besplatno'],
      ['price', '50000', 'sats'],
      ['duration', '14'],
      ['start', '1699999000'],
      ['end', '1701200000'],
      ['status', 'active'],
      ...tags,
    ],
  });
}

function settingsEvent(tags: string[][]): NostrEvent {
  return {
    kind: SPONSORED_SETTINGS_KIND,
    id: 'f'.padEnd(64, '0'),
    pubkey: ADMIN,
    created_at: 1_699_000_000,
    sig: 's'.padEnd(128, '0'),
    content: '',
    tags: [['d', SPONSORED_SETTINGS_D], ...tags],
  };
}

/* ── Campaign parsing ─────────────────────────────────────────────────── */

describe('parseCampaignEvent', () => {
  it('parses a valid sponsored-listing campaign with explicit fields', () => {
    const campaign = parseCampaignEvent(campaignEvent(), ADMINS);

    expect(campaign).not.toBeNull();
    expect(campaign?.type).toBe('sponsored-listing');
    expect(campaign?.listingCoordinate).toBe(LISTING_COORD);
    expect(campaign?.price).toEqual({ amount: 21000, currency: 'sats' });
    expect(campaign?.durationDays).toBe(7);
    expect(campaign?.status).toBe('active');
    expect(campaign?.priority).toBe(5);
    expect(campaign?.accent).toBe('primary');
    expect(campaign?.badge).toBe('featured');
    expect(campaign?.coordinate).toBe(`${SPONSORED_CAMPAIGN_KIND}:${ADMIN}:kampanja-1`);
  });

  it('parses a valid promo campaign with inline content', () => {
    const campaign = parseCampaignEvent(promoEvent([['description', 'Promo opis']]), ADMINS);

    expect(campaign?.type).toBe('promo');
    expect(campaign?.promo).toEqual({
      title: 'Najbolji Lightning wallet',
      image: 'https://img.example.com/banner.png',
      url: 'https://example.com',
      ctaLabel: 'Probaj besplatno',
      description: 'Promo opis',
    });
    expect(campaign?.listingCoordinate).toBeUndefined();
  });

  it('rejects events not signed by an admin', () => {
    expect(parseCampaignEvent(campaignEvent({ pubkey: OTHER }), ADMINS)).toBeNull();
  });

  it('rejects the wrong kind', () => {
    expect(parseCampaignEvent(campaignEvent({ kind: 30402 }), ADMINS)).toBeNull();
  });

  it('rejects a missing d tag', () => {
    const event = campaignEvent();
    event.tags = event.tags.filter(([name]) => name !== 'd');
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects an unknown type', () => {
    expect(
      parseCampaignEvent(
        campaignEvent({ tags: [['d', 'x'], ['type', 'neki-treci'], ['a', LISTING_COORD], ['price', '1', 'sats'], ['duration', '1'], ['start', '1699999000'], ['end', '1700000000']] }),
        ADMINS,
      ),
    ).toBeNull();
  });

  it('rejects sponsored-listing without a listing coordinate', () => {
    const event = campaignEvent();
    event.tags = event.tags.filter(([name]) => name !== 'a');
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects a coordinate that does not reference a NIP-99 listing', () => {
    const event = campaignEvent();
    event.tags = event.tags.map((tag) => (tag[0] === 'a' ? ['a', `36797:${OTHER}:escrow`] : tag));
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects promo without title', () => {
    const event = promoEvent([]);
    event.tags = event.tags.filter(([name]) => name !== 'title');
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects promo without image', () => {
    const event = promoEvent([]);
    event.tags = event.tags.filter(([name]) => name !== 'image');
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects promo with a non-https image', () => {
    const event = promoEvent([]);
    event.tags = event.tags.map((tag) => (tag[0] === 'image' ? ['image', 'http://img.example.com/x.png'] : tag));
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects promo with a non-https CTA url', () => {
    const event = promoEvent([]);
    event.tags = event.tags.map((tag) => (tag[0] === 'url' ? ['url', 'javascript:alert(1)'] : tag));
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects USDC currency (locked decision: sats/BTC/USDT only)', () => {
    const event = campaignEvent();
    event.tags = event.tags.map((tag) => (tag[0] === 'price' ? ['price', '25', 'USDC'] : tag));
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('accepts BTC and USDT currencies', () => {
    for (const currency of ['BTC', 'USDT']) {
      const event = campaignEvent();
      event.tags = event.tags.map((tag) => (tag[0] === 'price' ? ['price', '0.5', currency] : tag));
      const campaign = parseCampaignEvent(event, ADMINS);
      expect(campaign?.price.currency).toBe(currency);
    }
  });

  it('rejects a non-positive price amount', () => {
    const event = campaignEvent();
    event.tags = event.tags.map((tag) => (tag[0] === 'price' ? ['price', '0', 'sats'] : tag));
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects end at or before start', () => {
    const event = campaignEvent({
      tags: [['d', 'x'], ['type', 'sponsored-listing'], ['a', LISTING_COORD], ['price', '1', 'sats'], ['duration', '1'], ['start', '1700000000'], ['end', '1700000000']],
    });
    expect(parseCampaignEvent(event, ADMINS)).toBeNull();
  });

  it('rejects duration outside 1–365 days', () => {
    for (const days of ['0', '366']) {
      const event = campaignEvent();
      event.tags = event.tags.map((tag) => (tag[0] === 'duration' ? ['duration', days] : tag));
      expect(parseCampaignEvent(event, ADMINS)).toBeNull();
    }
  });

  it('fails safe to disabled for an unknown status', () => {
    const event = campaignEvent();
    event.tags = event.tags.map((tag) => (tag[0] === 'status' ? ['status', 'hacked'] : tag));
    expect(parseCampaignEvent(event, ADMINS)?.status).toBe('disabled');
  });

  it('clamps priority into the safe range', () => {
    const event = campaignEvent();
    event.tags = event.tags.map((tag) => (tag[0] === 'priority' ? ['priority', '99999'] : tag));
    expect(parseCampaignEvent(event, ADMINS)?.priority).toBe(1000);
  });

  it('falls back to default accent and badge for unknown enum values', () => {
    const event = promoEvent([['accent', 'rainbow'], ['badge', 'ultra']]);
    const campaign = parseCampaignEvent(event, ADMINS);
    expect(campaign?.accent).toBe('primary');
    expect(campaign?.badge).toBe('featured');
  });
});

/* ── Visibility & ordering ────────────────────────────────────────────── */

describe('campaign visibility and ordering', () => {
  function campaign(overrides: Partial<AdCampaign>): AdCampaign {
    return {
      event: {} as NostrEvent,
      author: ADMIN,
      d: 'x',
      type: 'sponsored-listing',
      startAt: NOW - 100,
      endAt: NOW + 100,
      createdAt: NOW,
      coordinate: `${SPONSORED_CAMPAIGN_KIND}:${ADMIN}:x`,
      price: { amount: 1, currency: 'sats' },
      durationDays: 1,
      status: 'active',
      priority: 0,
      accent: 'primary',
      badge: 'featured',
      ...overrides,
    };
  }

  it('is visible inside the window when active', () => {
    expect(isCampaignVisible(campaign({}), NOW)).toBe(true);
  });

  it('is not visible before start, after end, or when disabled', () => {
    expect(isCampaignVisible(campaign({ startAt: NOW + 10 }), NOW)).toBe(false);
    expect(isCampaignVisible(campaign({ endAt: NOW }), NOW)).toBe(false);
    expect(isCampaignVisible(campaign({ status: 'disabled' }), NOW)).toBe(false);
  });

  it('sorts by priority DESC, then start ASC', () => {
    const a = campaign({ d: 'a', priority: 1, startAt: NOW - 50 });
    const b = campaign({ d: 'b', priority: 5, startAt: NOW - 10 });
    const c = campaign({ d: 'c', priority: 5, startAt: NOW - 90 });

    expect([a, b, c].sort(sortCampaigns).map((x) => x.d)).toEqual(['c', 'b', 'a']);
  });

  it('getVisibleCampaigns filters and sorts', () => {
    const visibleHigh = campaign({ d: 'high', priority: 9 });
    const visibleLow = campaign({ d: 'low', priority: 1 });
    const disabled = campaign({ d: 'off', status: 'disabled' });
    const expired = campaign({ d: 'old', endAt: NOW - 1 });

    expect(getVisibleCampaigns([visibleLow, disabled, visibleHigh, expired], NOW).map((x) => x.d)).toEqual([
      'high',
      'low',
    ]);
  });

  it('campaignPath encodes the campaign naddr', () => {
    const path = campaignPath({ author: ADMIN, d: 'kampanja-1' });
    expect(path.startsWith('/naddr1')).toBe(true);
  });
});

/* ── Settings parsing ─────────────────────────────────────────────────── */

describe('parseSettingsEvent', () => {
  it('parses published settings', () => {
    const settings = parseSettingsEvent(
      settingsEvent([
        ['desktopAds', '2'],
        ['secondsPerSlide', '8'],
        ['autoRotate', 'false'],
      ]),
      ADMINS,
    );

    expect(settings).toEqual({
      desktopAds: 2,
      mobileAds: 1,
      secondsPerSlide: 8,
      autoRotate: false,
      pauseOnInteraction: true,
    });
  });

  it('falls back to defaults for missing tags', () => {
    expect(parseSettingsEvent(settingsEvent([]), ADMINS)).toEqual(DEFAULT_SLIDER_SETTINGS);
  });

  it('clamps values into safe bounds', () => {
    const settings = parseSettingsEvent(
      settingsEvent([
        ['desktopAds', '9'],
        ['secondsPerSlide', '1'],
      ]),
      ADMINS,
    );

    expect(settings?.desktopAds).toBe(3);
    expect(settings?.secondsPerSlide).toBe(3);
  });

  it('rejects non-admin authors and wrong d tag', () => {
    expect(parseSettingsEvent({ ...settingsEvent([]), pubkey: OTHER }, ADMINS)).toBeNull();

    const wrongD = settingsEvent([]);
    wrongD.tags = [['d', 'not-slider']];
    expect(parseSettingsEvent(wrongD, ADMINS)).toBeNull();
  });
});

/* ── Fail-safe default state ──────────────────────────────────────────── */

describe('admin trust model defaults', () => {
  it('ships with no admin pubkeys configured (nothing renders)', () => {
    expect(ADMIN_PUBKEYS).toHaveLength(0);
  });
});
