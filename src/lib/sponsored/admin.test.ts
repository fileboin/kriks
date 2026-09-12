import { describe, expect, it } from 'vitest';

import { isAdminPubkey } from '@/lib/admin';
import {
  campaignTags,
  getCampaignLifecycleStatus,
  parseCampaignEvent,
} from '@/lib/sponsored/core';
import { SPONSORED_CAMPAIGN_KIND } from '@/lib/sponsored/kinds';
import type { NostrEvent } from '@nostrify/nostrify';

const ADMIN = 'aa'.repeat(32);
const OTHER = 'bb'.repeat(32);

function event(tags: string[][], pubkey = ADMIN): NostrEvent {
  return {
    kind: SPONSORED_CAMPAIGN_KIND,
    id: 'a'.repeat(64),
    pubkey,
    created_at: 1_700_000_000,
    sig: 'b'.repeat(128),
    content: '',
    tags,
  };
}

function validTags(): string[][] {
  return [
    ['d', 'admin-test'], ['type', 'promo'], ['title', 'Promo'],
    ['image', 'https://example.com/a.png'], ['url', 'https://example.com'],
    ['cta', 'Otvori'], ['price', '1000', 'sats'], ['duration', '7'],
    ['start', '1699999000'], ['end', '1700604000'], ['status', 'active'],
  ];
}

describe('SP3 admin campaign management primitives', () => {
  it('allows only configured admin pubkeys', () => {
    expect(isAdminPubkey(ADMIN, [ADMIN])).toBe(true);
    expect(isAdminPubkey(OTHER, [ADMIN])).toBe(false);
    expect(isAdminPubkey(ADMIN, [])).toBe(false);
  });

  it('parses a valid promo created from the admin form', () => {
    expect(parseCampaignEvent(event(validTags()), [ADMIN])?.type).toBe('promo');
  });

  it('rejects invalid HTTPS form data through SP1 parser', () => {
    const tags = validTags().map((tag) => tag[0] === 'url' ? ['url', 'http://example.com'] : tag);
    expect(parseCampaignEvent(event(tags), [ADMIN])).toBeNull();
  });

  it('rejects unsupported USDC and invalid duration/price', () => {
    for (const replacement of [
      ['price', '1000', 'USDC'],
      ['price', '0', 'sats'],
      ['duration', '0'],
    ]) {
      const tags = validTags().map((tag) => tag[0] === replacement[0] ? replacement : tag);
      expect(parseCampaignEvent(event(tags), [ADMIN])).toBeNull();
    }
  });

  it('campaignTags emits disabled status without payment claims', () => {
    const tags = campaignTags({
      d: 'draft', type: 'promo', priceAmount: 1000, currency: 'USDT', durationDays: 7,
      startAt: 1_700_000_000, endAt: 1_700_604_800, enabled: false, priority: 3,
      accent: 'amber', badge: 'promo',
      promo: { title: 'Promo', image: 'https://example.com/a.png', url: 'https://example.com', ctaLabel: 'Otvori' },
    });
    expect(tags).toContainEqual(['status', 'disabled']);
    expect(tags.some(([name]) => name === 'payment-confirmed')).toBe(false);
  });

  it('derives draft/scheduled/active/expired/disabled deterministically', () => {
    const base = {
      event: {} as NostrEvent, author: ADMIN, d: 'x', type: 'promo' as const,
      price: { amount: 1, currency: 'sats' as const }, durationDays: 1,
      priority: 0, accent: 'primary' as const, badge: 'featured' as const,
      createdAt: 1, coordinate: '35239:admin:x',
      promo: { title: 'x', image: 'https://example.com/x', url: 'https://example.com', ctaLabel: 'Go' },
    };
    expect(getCampaignLifecycleStatus({ ...base, status: 'disabled', startAt: 100, endAt: 300 }, 200)).toBe('disabled');
    expect(getCampaignLifecycleStatus({ ...base, status: 'active', startAt: 100, endAt: 300 }, 50)).toBe('scheduled');
    expect(getCampaignLifecycleStatus({ ...base, status: 'active', startAt: 100, endAt: 300 }, 200)).toBe('active');
    expect(getCampaignLifecycleStatus({ ...base, status: 'active', startAt: 100, endAt: 300 }, 300)).toBe('expired');
  });
});
