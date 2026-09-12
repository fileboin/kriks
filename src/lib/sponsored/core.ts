import { nip19 } from 'nostr-tools';

import type { NostrEvent } from '@nostrify/nostrify';

import { isAdminPubkey } from '@/lib/admin';
import { LISTING_KIND, sanitizeUrl } from '@/lib/listings';

import { SPONSORED_CAMPAIGN_KIND, SPONSORED_SETTINGS_D, SPONSORED_SETTINGS_KIND } from './kinds';

/**
 * Sponsored / featured campaigns — core model, parsing and validation (SP1).
 *
 * Trust: campaigns and settings are ONLY valid when signed by an admin
 * pubkey (authors filter at the relay + authorization check at parse —
 * defense in depth, same rule AGENTS.md mandates for addressable events).
 *
 * Appearance is enum-only by design: no HTML, no CSS, no free-form config
 * from admin — only predefined, safe options. All URLs are https-only
 * (sanitizeUrl). Currency is locked to sats/BTC/USDT (no USDC in MVP).
 */

export type CampaignType = 'sponsored-listing' | 'promo';
export type CampaignCurrency = 'sats' | 'BTC' | 'USDT';
export type CampaignStatus = 'active' | 'disabled';
export type CampaignAccent = 'primary' | 'amber' | 'green';
export type CampaignBadge = 'featured' | 'promo' | 'new';

/** Inline content for `promo` campaigns (referral/promotional material). */
export interface PromoContent {
  /** 1–80 chars. */
  title: string;
  /** https-only image URL. */
  image: string;
  /** https-only CTA destination. */
  url: string;
  /** 1–24 chars. */
  ctaLabel: string;
  /** 1–200 chars, plain text (rendered as text, never HTML). */
  description?: string;
}

export interface AdCampaign {
  event: NostrEvent;
  /** Admin pubkey — verified at parse time. */
  author: string;
  d: string;
  type: CampaignType;
  /** Required for `sponsored-listing`: coordinate of the promoted NIP-99 listing. */
  listingCoordinate?: string;
  /** Required for `promo`. */
  promo?: PromoContent;
  price: { amount: number; currency: CampaignCurrency };
  durationDays: number;
  startAt: number;
  endAt: number;
  status: CampaignStatus;
  priority: number;
  accent: CampaignAccent;
  badge: CampaignBadge;
  createdAt: number;
  /** Addressable coordinate "35239:<author>:<d>". */
  coordinate: string;
}

export interface SliderSettings {
  /** 1–3 (locked decision: default 3 on desktop). */
  desktopAds: number;
  /** Locked decision: 1 on mobile. */
  mobileAds: number;
  /** 3–30 s (locked decision: minimum 3 s anti-flicker). */
  secondsPerSlide: number;
  autoRotate: boolean;
  pauseOnInteraction: boolean;
}

/* ── Safe bounds (enforced at parse — see NIP.md) ─────────────────────── */

export const CAMPAIGN_CURRENCIES = ['sats', 'BTC', 'USDT'] as const;

export const TITLE_MAX = 80;
export const CTA_MAX = 24;
export const DESCRIPTION_MAX = 200;
export const DURATION_MIN = 1;
export const DURATION_MAX = 365;
export const PRIORITY_RANGE = 1000;

export const DESKTOP_ADS_MIN = 1;
export const DESKTOP_ADS_MAX = 3;
export const SECONDS_PER_SLIDE_MIN = 3;
export const SECONDS_PER_SLIDE_MAX = 30;

export const DEFAULT_SLIDER_SETTINGS: SliderSettings = {
  desktopAds: 3,
  mobileAds: 1,
  secondsPerSlide: 6,
  autoRotate: true,
  pauseOnInteraction: true,
};

const DEFAULT_CTA_LABEL = 'Saznaj više';

/* ── Helpers ──────────────────────────────────────────────────────────── */

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ── Campaign parsing/validation ─────────────────────────────────────── */

/**
 * Parse + validate a kind 35239 campaign event.
 * Returns null when malformed, out of bounds, or not signed by an admin.
 *
 * `admins` is injectable for tests; defaults to the configured ADMIN_PUBKEYS.
 */
export function parseCampaignEvent(
  event: NostrEvent,
  admins?: readonly string[],
): AdCampaign | null {
  if (event.kind !== SPONSORED_CAMPAIGN_KIND) return null;
  // Trust boundary: only admin-signed campaigns are ever valid.
  if (!isAdminPubkey(event.pubkey, admins)) return null;

  const d = tagValue(event, 'd');
  if (!d) return null;

  const type = tagValue(event, 'type');
  if (type !== 'sponsored-listing' && type !== 'promo') return null;

  // Price — currency locked to sats/BTC/USDT (no USDC in the MVP).
  const priceTag = event.tags.find(([n]) => n === 'price');
  if (!priceTag || priceTag.length < 3) return null;
  const amount = Number(priceTag[1]);
  const currency = priceTag[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!CAMPAIGN_CURRENCIES.includes(currency as CampaignCurrency)) return null;

  // Duration, schedule.
  const durationDays = parsePositiveInt(tagValue(event, 'duration'));
  if (durationDays === undefined || durationDays < DURATION_MIN || durationDays > DURATION_MAX) {
    return null;
  }
  const startAt = parsePositiveInt(tagValue(event, 'start'));
  const endAt = parsePositiveInt(tagValue(event, 'end'));
  if (startAt === undefined || endAt === undefined || endAt <= startAt) return null;

  // Status — unknown/missing fails SAFE to 'disabled'.
  const status: CampaignStatus = tagValue(event, 'status') === 'active' ? 'active' : 'disabled';

  // Priority — clamped to a sane range, default 0.
  const priorityRaw = Number(tagValue(event, 'priority') ?? 0);
  const priority = Number.isFinite(priorityRaw)
    ? clamp(Math.trunc(priorityRaw), -PRIORITY_RANGE, PRIORITY_RANGE)
    : 0;

  // Appearance — enum-only, lenient defaults (never free-form values).
  const accentRaw = tagValue(event, 'accent');
  const accent: CampaignAccent = accentRaw === 'amber' || accentRaw === 'green' ? accentRaw : 'primary';
  const badgeRaw = tagValue(event, 'badge');
  const badge: CampaignBadge = badgeRaw === 'promo' || badgeRaw === 'new' ? badgeRaw : 'featured';

  // Type-specific content.
  let listingCoordinate: string | undefined;
  let promo: PromoContent | undefined;

  if (type === 'sponsored-listing') {
    const a = tagValue(event, 'a');
    if (!a || !a.startsWith(`${LISTING_KIND}:`)) return null;
    listingCoordinate = a;
  } else {
    const title = tagValue(event, 'title')?.trim() ?? '';
    if (title.length < 1 || title.length > TITLE_MAX) return null;

    const image = sanitizeUrl(tagValue(event, 'image') ?? '');
    if (!image) return null;

    const url = sanitizeUrl(tagValue(event, 'url') ?? '');
    if (!url) return null;

    const ctaLabel = tagValue(event, 'cta')?.trim() || DEFAULT_CTA_LABEL;
    if (ctaLabel.length < 1 || ctaLabel.length > CTA_MAX) return null;

    const description = tagValue(event, 'description')?.trim();
    if (description !== undefined && description.length > DESCRIPTION_MAX) return null;

    promo = { title, image, url, ctaLabel, description: description || undefined };
  }

  return {
    event,
    author: event.pubkey,
    d,
    type,
    listingCoordinate,
    promo,
    price: { amount, currency: currency as CampaignCurrency },
    durationDays,
    startAt,
    endAt,
    status,
    priority,
    accent,
    badge,
    createdAt: event.created_at,
    coordinate: `${SPONSORED_CAMPAIGN_KIND}:${event.pubkey}:${d}`,
  };
}

/* ── Visibility & ordering ────────────────────────────────────────────── */

/** Is the campaign active and inside its schedule window? */
export type CampaignLifecycleStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled';

/** Deterministic UI lifecycle status derived from campaign data. */
export function getCampaignLifecycleStatus(
  campaign: AdCampaign,
  nowSec: number = Math.floor(Date.now() / 1000),
): CampaignLifecycleStatus {
  if (campaign.status === 'disabled') return 'disabled';
  if (nowSec >= campaign.endAt) return 'expired';
  if (nowSec < campaign.startAt) return 'scheduled';
  return 'active';
}

export function isCampaignVisible(campaign: AdCampaign, nowSec: number = Math.floor(Date.now() / 1000)): boolean {
  return getCampaignLifecycleStatus(campaign, nowSec) === 'active';
} 

/** Build the safe Nostr tags for an admin campaign form before signing. */
export function campaignTags(input: {
  d: string;
  type: CampaignType;
  priceAmount: number;
  currency: CampaignCurrency;
  durationDays: number;
  startAt: number;
  endAt: number;
  enabled: boolean;
  priority: number;
  accent: CampaignAccent;
  badge: CampaignBadge;
  listingCoordinate?: string;
  promo?: PromoContent;
}): string[][] {
  const tags: string[][] = [
    ['d', input.d],
    ['type', input.type],
    ['price', String(input.priceAmount), input.currency],
    ['duration', String(input.durationDays)],
    ['start', String(input.startAt)],
    ['end', String(input.endAt)],
    ['status', input.enabled ? 'active' : 'disabled'],
    ['priority', String(input.priority)],
    ['accent', input.accent],
    ['badge', input.badge],
    ['alt', `Sponzorisana kampanja: ${input.type}`],
  ];
  if (input.type === 'sponsored-listing' && input.listingCoordinate) {
    tags.push(['a', input.listingCoordinate]);
  }
  if (input.type === 'promo' && input.promo) {
    tags.push(['title', input.promo.title], ['image', input.promo.image], ['url', input.promo.url], ['cta', input.promo.ctaLabel]);
    if (input.promo.description) tags.push(['description', input.promo.description]);
  }
  return tags;
} 

/** Priority DESC → start ASC → d (stable tiebreak). */
export function sortCampaigns(a: AdCampaign, b: AdCampaign): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.startAt !== b.startAt) return a.startAt - b.startAt;
  return a.d.localeCompare(b.d);
}

/** Visible campaigns, priority-ordered — what the slider will render (SP2). */
export function getVisibleCampaigns(
  campaigns: AdCampaign[],
  nowSec: number = Math.floor(Date.now() / 1000),
): AdCampaign[] {
  return campaigns.filter((campaign) => isCampaignVisible(campaign, nowSec)).sort(sortCampaigns);
}

/** NIP-19 path of a campaign detail (used by later phases). */
export function campaignPath(campaign: Pick<AdCampaign, 'author' | 'd'>): string {
  return `/${nip19.naddrEncode({
    kind: SPONSORED_CAMPAIGN_KIND,
    pubkey: campaign.author,
    identifier: campaign.d,
  })}`;
}

/* ── Slider settings parsing ─────────────────────────────────────────── */

/**
 * Parse the kind 37197 settings singleton. Values are clamped to safe
 * bounds; anything missing falls back to the locked defaults.
 * Returns null when the event is not admin-signed or not the settings event.
 */
export function parseSettingsEvent(
  event: NostrEvent,
  admins?: readonly string[],
): SliderSettings | null {
  if (event.kind !== SPONSORED_SETTINGS_KIND) return null;
  if (!isAdminPubkey(event.pubkey, admins)) return null;
  if (tagValue(event, 'd') !== SPONSORED_SETTINGS_D) return null;

  const desktopAdsRaw = parsePositiveInt(tagValue(event, 'desktopAds'));
  const desktopAds = desktopAdsRaw === undefined
    ? DEFAULT_SLIDER_SETTINGS.desktopAds
    : clamp(desktopAdsRaw, DESKTOP_ADS_MIN, DESKTOP_ADS_MAX);

  const secondsRaw = parsePositiveInt(tagValue(event, 'secondsPerSlide'));
  const secondsPerSlide = secondsRaw === undefined
    ? DEFAULT_SLIDER_SETTINGS.secondsPerSlide
    : clamp(secondsRaw, SECONDS_PER_SLIDE_MIN, SECONDS_PER_SLIDE_MAX);

  return {
    desktopAds,
    mobileAds: 1, // locked decision — always 1 on mobile
    secondsPerSlide,
    autoRotate: tagValue(event, 'autoRotate') !== 'false',
    pauseOnInteraction: tagValue(event, 'pauseOnInteraction') !== 'false',
  };
}
