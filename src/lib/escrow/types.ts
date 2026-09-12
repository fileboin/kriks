import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Oglasnik escrow protocol — core types.
 *
 * Two custom kinds (documented in NIP.md):
 * - ESCROW_KIND (36797, addressable): the escrow contract / terms. Author = initiator.
 * - ESCROW_ACTION_KIND (1951, regular): signed state transitions by buyer/seller/arbiter.
 */

/** Addressable escrow contract event. */
export const ESCROW_KIND = 36797;

/** Regular escrow action event (state machine transition). */
export const ESCROW_ACTION_KIND = 1951;

export type EscrowRole = 'buyer' | 'seller' | 'arbiter';

export type EscrowVerb =
  | 'accept'
  | 'decline'
  | 'fund'
  | 'deliver'
  | 'release'
  | 'dispute'
  | 'resolve';

export type EscrowStatus =
  | 'proposed'
  | 'active'
  | 'funded'
  | 'delivered'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'declined'
  | 'expired';

/** Adapter-agnostic parsed view of an escrow contract event. */
export interface EscrowContract {
  event: NostrEvent;
  /** Initiator of the proposal (event author). */
  initiator: string;
  buyer: string;
  seller: string;
  arbiter: string;
  adapterId: string;
  /** Addressable coordinate "36797:<initiator>:<d>". */
  coordinate: string;
  d: string;
  /** Optional listing coordinate this escrow was spawned from. */
  listingCoordinate?: string;
  /** Unix seconds after which an unaccepted proposal is expired. */
  expiration?: number;
  createdAt: number;
  /** Raw terms JSON content (validated by the adapter on read). */
  terms: Record<string, string>;
}

/** Parsed view of an escrow action event. */
export interface EscrowAction {
  event: NostrEvent;
  author: string;
  verb: EscrowVerb;
  /** Only for `resolve`: "release" | "refund". */
  outcome?: 'release' | 'refund';
  coordinate: string;
  createdAt: number;
  /** Optional note / proof (txid, invoice, message). */
  note?: string;
}

/** Fully derived escrow state (contract + folded actions). */
export interface EscrowState {
  contract: EscrowContract;
  status: EscrowStatus;
  /** Valid actions in chronological order — the escrow's audit trail. */
  trail: EscrowAction[];
}

/** Which party may perform a verb. */
export const VERB_ROLES: Record<EscrowVerb, readonly EscrowRole[]> = {
  accept: ['buyer', 'seller'],
  decline: ['buyer', 'seller'],
  fund: ['buyer'],
  deliver: ['seller'],
  release: ['buyer'],
  dispute: ['buyer', 'seller'],
  resolve: ['arbiter'],
};

export const ESCROW_VERBS: readonly EscrowVerb[] = [
  'accept',
  'decline',
  'fund',
  'deliver',
  'release',
  'dispute',
  'resolve',
];

/** Terminal statuses — no further transitions allowed. */
export const TERMINAL_STATUSES: readonly EscrowStatus[] = [
  'released',
  'refunded',
  'declined',
];
