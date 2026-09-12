import { nip19 } from 'nostr-tools';

import type { NostrEvent } from '@nostrify/nostrify';

import { getEscrowAdapter } from './adapters';
import {
  ESCROW_ACTION_KIND,
  ESCROW_KIND,
  ESCROW_VERBS,
  TERMINAL_STATUSES,
  VERB_ROLES,
  type EscrowAction,
  type EscrowContract,
  type EscrowRole,
  type EscrowState,
  type EscrowStatus,
  type EscrowVerb,
} from './types';

/** Roles of the three ordered `p` tags on the contract (see NIP.md). */
const P_TAG_ROLES: readonly EscrowRole[] = ['buyer', 'seller', 'arbiter'];

const HEX_PUBKEY = /^[0-9a-f]{64}$/;

export function isHexPubkey(value: string | undefined): value is string {
  return Boolean(value && HEX_PUBKEY.test(value));
}

export function escrowCoordinate(initiator: string, d: string): string {
  return `${ESCROW_KIND}:${initiator}:${d}`;
}

export function escrowPath(contract: Pick<EscrowContract, 'initiator' | 'd'>): string {
  return `/${nip19.naddrEncode({
    kind: ESCROW_KIND,
    pubkey: contract.initiator,
    identifier: contract.d,
  })}`;
}

export function generateEscrowId(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/** "npub1abc123…wxyz" — compact display form of a pubkey. */
export function shortNpub(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

/** Parse + validate a kind 36797 escrow contract. Returns null when malformed. */
export function parseEscrowContract(event: NostrEvent): EscrowContract | null {
  if (event.kind !== ESCROW_KIND) return null;

  const d = event.tags.find(([name]) => name === 'd')?.[1];
  if (!d) return null;

  const participants = event.tags
    .filter(([name]) => name === 'p')
    .map((tag) => tag[1]);
  if (participants.length !== 3) return null;
  if (!participants.every((pk) => isHexPubkey(pk))) return null;
  if (new Set(participants).size !== 3) return null;

  const [buyer, seller, arbiter] = participants;
  if (!isHexPubkey(event.pubkey)) return null;

  const adapterId = event.tags.find(([name]) => name === 't')?.[1];
  if (!adapterId || !getEscrowAdapter(adapterId)) return null;

  let terms: Record<string, string>;
  try {
    const parsed = JSON.parse(event.content) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    terms = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        .map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return null;
  }

  const expirationTag = event.tags.find(([name]) => name === 'expiration')?.[1];
  const expiration = expirationTag ? Number(expirationTag) : undefined;

  return {
    event,
    initiator: event.pubkey,
    buyer,
    seller,
    arbiter,
    adapterId,
    coordinate: escrowCoordinate(event.pubkey, d),
    d,
    listingCoordinate: event.tags.find(([name]) => name === 'a')?.[1],
    expiration: Number.isFinite(expiration) && expiration !== undefined && expiration > 0
      ? expiration
      : undefined,
    createdAt: event.created_at,
    terms,
  };
}

/** Parse + validate a kind 1951 escrow action. Returns null when malformed. */
export function parseEscrowAction(event: NostrEvent): EscrowAction | null {
  if (event.kind !== ESCROW_ACTION_KIND) return null;

  const verb = event.tags.find(([name]) => name === 'verb')?.[1];
  if (!verb || !ESCROW_VERBS.includes(verb as EscrowVerb)) return null;

  const coordinate = event.tags.find(([name]) => name === 'a')?.[1];
  if (!coordinate || !coordinate.startsWith(`${ESCROW_KIND}:`)) return null;

  if (!isHexPubkey(event.pubkey)) return null;

  let outcome: 'release' | 'refund' | undefined;
  if (verb === 'resolve') {
    const outcomeTag = event.tags.find(([name]) => name === 'outcome')?.[1];
    outcome = outcomeTag === 'release' || outcomeTag === 'refund' ? outcomeTag : undefined;
    if (!outcome) return null;
  }

  return {
    event,
    author: event.pubkey,
    verb: verb as EscrowVerb,
    outcome,
    coordinate,
    createdAt: event.created_at,
    note: event.content.trim() || undefined,
  };
}

/** Role of a pubkey within an escrow contract. */
export function escrowRoleOf(contract: EscrowContract, pubkey: string): EscrowRole | undefined {
  if (pubkey === contract.buyer) return 'buyer';
  if (pubkey === contract.seller) return 'seller';
  if (pubkey === contract.arbiter) return 'arbiter';
  return undefined;
}

/** Accept npub1…, nprofile1… or a raw 64-char hex pubkey. */
export function parsePubkeyInput(value: string): string | undefined {
  const v = value.trim();
  if (isHexPubkey(v)) return v;
  try {
    const decoded = nip19.decode(v);
    if (decoded.type === 'npub' && typeof decoded.data === 'string') return decoded.data;
    if (decoded.type === 'nprofile' && typeof decoded.data === 'object') {
      return (decoded.data as { pubkey: string }).pubkey;
    }
  } catch {
    // fall through
  }
  return undefined;
}

/** Is an action valid in the given status, for the given actor? */
function isValidTransition(
  contract: EscrowContract,
  status: EscrowStatus,
  action: EscrowAction,
): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false;
  if (status === 'expired') return false;

  const role = escrowRoleOf(contract, action.author);
  if (!role) return false;
  if (!VERB_ROLES[action.verb].includes(role)) return false;

  // Only the counterparty (not the initiator) may accept or decline.
  if (action.verb === 'accept' || action.verb === 'decline') {
    if (action.author === contract.initiator) return false;
    if (status !== 'proposed') return false;
  }

  switch (action.verb) {
    case 'accept':
      return true;
    case 'decline':
      return true;
    case 'fund':
      return status === 'active';
    case 'deliver':
      return status === 'funded';
    case 'release':
      return status === 'delivered';
    case 'dispute':
      return status === 'active' || status === 'funded' || status === 'delivered';
    case 'resolve':
      return status === 'disputed';
    default:
      return false;
  }
}

function applyVerb(status: EscrowStatus, action: EscrowAction): EscrowStatus {
  switch (action.verb) {
    case 'accept':
      return 'active';
    case 'decline':
      return 'declined';
    case 'fund':
      return 'funded';
    case 'deliver':
      return 'delivered';
    case 'release':
      return 'released';
    case 'dispute':
      return 'disputed';
    case 'resolve':
      return action.outcome === 'refund' ? 'refunded' : 'released';
    default:
      return status;
  }
}

/**
 * Fold a contract and its actions into the derived escrow state.
 * Invalid transitions are ignored (the protocol is append-only and signed,
 * so garbage actions can't corrupt the trail of valid ones).
 */
export function deriveEscrowState(
  contract: EscrowContract,
  actions: NostrEvent[],
): EscrowState {
  const parsed = actions
    .map(parseEscrowAction)
    .filter((action): action is EscrowAction => action !== null)
    .filter((action) => action.coordinate === contract.coordinate)
    // Ignore actions signed before this contract version — if the initiator
    // re-publishes the coordinate, prior consent/actions do not carry over.
    .filter((action) => action.createdAt >= contract.createdAt)
    .sort((a, b) => a.createdAt - b.createdAt || a.event.id.localeCompare(b.event.id));

  let status: EscrowStatus = 'proposed';
  const trail: EscrowAction[] = [];

  for (const action of parsed) {
    if (isValidTransition(contract, status, action)) {
      status = applyVerb(status, action);
      trail.push(action);
    }
  }

  if (
    status === 'proposed' &&
    contract.expiration !== undefined &&
    Date.now() / 1000 > contract.expiration
  ) {
    status = 'expired';
  }

  return { contract, status, trail };
}

export interface EscrowNextAction {
  verb: EscrowVerb;
  /** Serbian label for the button. */
  label: string;
  outcome?: 'release' | 'refund';
  destructive?: boolean;
  requiresNote?: boolean;
}

/** What the viewer may do next, given their role (if any). */
export function nextEscrowActions(state: EscrowState, viewerPubkey: string | undefined): EscrowNextAction[] {
  if (!viewerPubkey) return [];
  const role = escrowRoleOf(state.contract, viewerPubkey);
  if (!role) return [];

  const isCounterparty = viewerPubkey !== state.contract.initiator;

  switch (state.status) {
    case 'proposed':
      return isCounterparty
        ? [
            { verb: 'accept', label: 'Prihvati escrow' },
            { verb: 'decline', label: 'Odbij', destructive: true },
          ]
        : [];
    case 'active':
      return [
        ...(role === 'buyer' ? [{ verb: 'fund', label: 'Uplaćeno', requiresNote: true } as EscrowNextAction] : []),
        { verb: 'dispute', label: 'Otvori spor', destructive: true },
      ];
    case 'funded':
      return [
        ...(role === 'seller' ? [{ verb: 'deliver', label: 'Isporučeno', requiresNote: true } as EscrowNextAction] : []),
        { verb: 'dispute', label: 'Otvori spor', destructive: true },
      ];
    case 'delivered':
      return [
        ...(role === 'buyer' ? [{ verb: 'release', label: 'Pusti sredstva' } as EscrowNextAction] : []),
        { verb: 'dispute', label: 'Otvori spor', destructive: true },
      ];
    case 'disputed':
      return role === 'arbiter'
        ? [
            { verb: 'resolve', label: 'Presudi: kupcu (refund)', outcome: 'refund', requiresNote: true },
            { verb: 'resolve', label: 'Presudi: prodavcu (release)', outcome: 'release', requiresNote: true },
          ]
        : [];
    default:
      return [];
  }
}

/**
 * How far the happy path progressed (0–4), used by the stepper UI.
 * For disputed/refunded escrows, walks the trail up to the dispute.
 */
export function escrowProgress(state: EscrowState): number {
  switch (state.status) {
    case 'active':
      return 1;
    case 'funded':
      return 2;
    case 'delivered':
      return 3;
    case 'released':
      return 4;
    case 'disputed':
    case 'refunded': {
      let depth = 0;
      for (const action of state.trail) {
        if (action.verb === 'dispute') break;
        if (action.verb === 'accept') depth = 1;
        if (action.verb === 'fund') depth = 2;
        if (action.verb === 'deliver') depth = 3;
      }
      return depth;
    }
    default:
      return 0;
  }
}

/** Serbian labels for statuses. */
export const STATUS_LABELS: Record<EscrowStatus, string> = {
  proposed: 'Čeka prihvatanje',
  active: 'Prihvaćeno — čeka uplatu',
  funded: 'Uplaćeno — čeka isporuku',
  delivered: 'Isporučeno — čeka potvrdu',
  released: 'Završeno — pušteno prodavcu',
  refunded: 'Završeno — refundirano kupcu',
  disputed: 'Spor — čeka odluku arbitra',
  declined: 'Odbijeno',
  expired: 'Isteklo',
};

/** Serbian labels for verbs (trail rendering). */
export const VERB_LABELS: Record<EscrowVerb, string> = {
  accept: 'prihvatio escrow',
  decline: 'odbio predlog',
  fund: 'označio uplatu',
  deliver: 'označio isporuku',
  release: 'pustio sredstva',
  dispute: 'otvorio spor',
  resolve: 'presudio',
};

/** Timeline steps (for the stepper UI) in happy-path order. */
export const TIMELINE: readonly { status: EscrowStatus; label: string }[] = [
  { status: 'proposed', label: 'Predlog' },
  { status: 'active', label: 'Prihvaćeno' },
  { status: 'funded', label: 'Uplaćeno' },
  { status: 'delivered', label: 'Isporučeno' },
  { status: 'released', label: 'Pušteno' },
];
