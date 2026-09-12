import { nip19 } from 'nostr-tools';

import type { NostrEvent } from '@nostrify/nostrify';

/** NIP-99 classified listing kind. */
export const LISTING_KIND = 30402;

/** Maximum number of images per listing. */
export const MAX_IMAGES = 4;

export interface ListingPrice {
  amount: number;
  currency: string;
  frequency?: string;
}

export interface Listing {
  event: NostrEvent;
  pubkey: string;
  d: string;
  title: string;
  summary?: string;
  location?: string;
  price?: ListingPrice;
  status: 'active' | 'sold';
  condition?: string;
  publishedAt: number;
  /** Sanitized https-only image URLs. */
  images: string[];
  categories: string[];
}

export interface Category {
  value: string;
  label: string;
}

/** Categories are relay-indexable `t` tags, so `#t` filters work at the relay level. */
export const CATEGORIES: Category[] = [
  { value: 'telefoni', label: 'Telefoni' },
  { value: 'sim-esim', label: 'SIM i eSIM' },
  { value: 'sms-otp', label: 'SMS OTP kodovi' },
  { value: 'racunari', label: 'Računari' },
  { value: 'elektronika', label: 'Elektronika' },
  { value: 'kripto', label: 'Kripto' },
  { value: 'vozila', label: 'Vozila' },
  { value: 'nekretnine', label: 'Nekretnine' },
  { value: 'namestaj', label: 'Nameštaj' },
  { value: 'odeca', label: 'Odeća i obuća' },
  { value: 'sport', label: 'Sport i hobiji' },
  { value: 'ljubimci', label: 'Kućni ljubimci' },
  { value: 'usluge', label: 'Usluge' },
  { value: 'saas-projekti', label: 'SaaS projekti' },
  { value: 'posao', label: 'Posao' },
  { value: 'besplatno', label: 'Besplatno' },
  { value: 'ostalo', label: 'Ostalo' },
];

export const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.value, c.label]));

export const CURRENCIES = ['RSD', 'EUR', 'USD', 'BTC'] as const;

export const CONDITIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'polovno', label: 'Polovno' },
] as const;

export const FREQUENCIES = [
  { value: 'hour', label: 'po satu' },
  { value: 'day', label: 'po danu' },
  { value: 'week', label: 'po nedelji' },
  { value: 'month', label: 'po mesecu' },
  { value: 'year', label: 'po godini' },
] as const;

/** Only allow https URLs from untrusted event data (CSP allows https images only). */
export function sanitizeUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Parse and validate a NIP-99 kind 30402 event into a structured listing. */
export function parseListing(event: NostrEvent): Listing | null {
  if (event.kind !== LISTING_KIND) return null;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  const title = event.tags.find(([name]) => name === 'title')?.[1];

  // A listing without a `d` tag or title is malformed — drop it.
  if (!d || !title) return null;

  const priceTag = event.tags.find(([name]) => name === 'price');
  let price: ListingPrice | undefined;
  if (priceTag && priceTag.length >= 3) {
    const amount = Number(priceTag[1]);
    const currency = priceTag[2];
    if (Number.isFinite(amount) && currency) {
      price = { amount, currency, frequency: priceTag[3] };
    }
  }

  const images = event.tags
    .filter(([name]) => name === 'image')
    .map((tag) => tag[1])
    .map((url) => sanitizeUrl(url))
    .filter((url): url is string => Boolean(url));

  const categories = event.tags
    .filter(([name]) => name === 't')
    .map((tag) => tag[1])
    .filter((value): value is string => Boolean(value));

  return {
    event,
    pubkey: event.pubkey,
    d,
    title,
    summary: event.tags.find(([name]) => name === 'summary')?.[1],
    location: event.tags.find(([name]) => name === 'location')?.[1],
    price,
    status: event.tags.find(([name]) => name === 'status')?.[1] === 'sold' ? 'sold' : 'active',
    condition: event.tags.find(([name]) => name === 'condition')?.[1],
    publishedAt: Number(event.tags.find(([name]) => name === 'published_at')?.[1]) || event.created_at,
    images,
    categories,
  };
}

const CURRENCY_LABELS: Record<string, string> = {
  RSD: 'RSD',
  EUR: '€',
  USD: '$',
  BTC: 'BTC',
};

const FREQUENCY_LABELS: Record<string, string> = {
  hour: '/sat',
  day: '/dan',
  week: '/nedelja',
  month: '/mesec',
  year: '/godina',
};

export function formatPrice(price: ListingPrice | undefined): string {
  if (!price) return 'Cena po dogovoru';
  if (price.amount === 0) return 'Besplatno';
  const currency = CURRENCY_LABELS[price.currency.toUpperCase()] ?? price.currency;
  const amount = new Intl.NumberFormat('sr-RS').format(price.amount);
  const frequency = price.frequency ? FREQUENCY_LABELS[price.frequency] ?? `/${price.frequency}` : '';
  return `${amount} ${currency}${frequency}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return few;
  return many;
}

/** Relative time in Serbian, e.g. "pre 3 dana". */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'upravo objavljeno';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `pre ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pre ${hours} ${plural(hours, 'sat', 'sata', 'sati')}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `pre ${days} ${plural(days, 'dan', 'dana', 'dana')}`;
  const months = Math.floor(days / 30);
  return `pre ${months} ${plural(months, 'mesec', 'meseca', 'meseci')}`;
}

/** Path (naddr) where a listing detail is rendered by the NIP-19 router. */
export function listingPath(listing: Pick<Listing, 'pubkey' | 'd'>): string {
  return `/${nip19.naddrEncode({ kind: LISTING_KIND, pubkey: listing.pubkey, identifier: listing.d })}`;
}

/** Deterministic-ish slug: transliterated title + random suffix, used as the `d` tag. */
export function generateDTag(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/ž/g, 'z')
    .replace(/š/g, 's')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return slug ? `${slug}-${suffix}` : suffix;
}

/** Does a listing match a free-text query? (title, summary, location, description, categories) */
export function listingMatchesSearch(listing: Listing, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    listing.title,
    listing.summary,
    listing.location,
    listing.event.content,
    ...listing.categories,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}
