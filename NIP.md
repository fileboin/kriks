# NIP.md

This project implements **Oglasnik** — a Serbian-language classifieds board (oglasna tabla) on Nostr, plus a composable **escrow (jemstvo) system**.

## Kinds used

Standard kinds:

| Kind | NIP | Purpose |
|------|-----|---------|
| 30402 | [NIP-99](https://github.com/nostr-protocol/nips/blob/master/99.md) | Classified listing (active) |
| 5 | [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) | Listing deletion (`e` + `a` tags) |
| 14 | [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private chat message (rumor, inside gift wrap) |
| 13 | [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Seal wrapping the chat message rumor |
| 1059 | [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift wrap (ephemeral key) delivering the sealed message |

Custom kinds (generated, unused numbers verified):

| Kind | Range | Purpose |
|------|-------|---------|
| 36797 | addressable | Escrow contract (terms + participants) |
| 1951 | regular | Escrow action (signed state transition) |

## Escrow protocol

A three-party escrow between **buyer**, **seller** and **arbiter**. All state is
public, signed, append-only Nostr events — the "smart contract" is the
combination of a contract event and its action events.

### Kind 36797 — escrow contract (addressable)

Author = **initiator** (buyer or seller who proposed the trade).

Tags:

- `d` — unique escrow id (random)
- `p` × 3 — **ordered** participants: `[buyer, seller, arbiter]` (order defines roles)
- `t` — adapter id: `crypto-swap`, `goods` or `lightning-btc` (relay-indexable)
- `a` — optional listing coordinate (`30402:<pubkey>:<d>`) when spawned from a listing
- `expiration` — unix seconds; an unaccepted proposal expires after it
- `alt` — NIP-31 human-readable description

`content` = JSON object of adapter-specific terms (e.g.
`{"give_asset":"USDC","give_amount":"100","want_asset":"XMR","want_amount":"0.42"}`).
Terms are immutable **by convention**; re-publishing the coordinate resets
consent because actions older than the current contract version are ignored
(see `deriveEscrowState`).

### Kind 1951 — escrow action (regular)

Author = the acting party. One action = one state transition.

Tags:

- `a` — the escrow coordinate (`36797:<initiator>:<d>`)
- `e` — the contract event id
- `p` × 3 — participants copied from the contract (for `#p` filtering)
- `verb` — `accept` | `decline` | `fund` | `deliver` | `release` | `dispute` | `cancel` | `resolve`
- `outcome` — for `resolve` only: `release` (pay seller) or `refund` (pay buyer)
- `alt` — NIP-31 description

`content` = optional note/proof (txid, invoice, message) — public.

### State machine

```
proposed ──accept(counterparty)──▶ active ──fund(buyer)──▶ funded ──deliver(seller)──▶ delivered ──release(buyer)──▶ released
    │                                │                       │                          │
    ├──decline(counterparty)──▶ declined │                       │                          │
    ├──cancel(initiator)──▶ cancelled   └──────────── dispute(buyer|seller) ──────────────┘
    └──(expires)──▶ expired                       │
                                                 ▼
                                        resolve(arbiter) ──▶ released | refunded

active|funded ──cancel(A)──▶ cancelling ──cancel(B≠A)──▶ cancelled
                                │
                                └──dispute──▶ disputed (breaks a cancellation stalemate)
```

Valid transitions are enforced by `deriveEscrowState` (`src/lib/escrow/core.ts`):
- only the counterparty (not the initiator) may `accept`/`decline` a proposal
- verb ↔ role mapping: `fund`→buyer, `deliver`→seller, `release`→buyer, `resolve`→arbiter, `cancel`→buyer/seller
- `cancel` semantics:
  - on an unaccepted proposal the **initiator** may withdraw it (`cancelled`)
  - from `active`/`funded` either trade party may request cancellation (`cancelling`);
    only the **other** trade party confirms it (`cancelled`)
  - from `cancelling` either party may still open a dispute to break a stalemate
- invalid actions are ignored; terminal statuses (`released`, `refunded`,
  `cancelled`, `declined`) accept no transitions
- actions signed before the current contract version are ignored

### Adapters (core + adapter architecture)

The protocol is asset-agnostic. An adapter (`src/lib/escrow/adapters.ts`)
defines: the terms form fields, a trade summary, and buyer/seller step
guides. Adding a trade type (e.g. "prodajem USDC za XMR") = registering a
new adapter; the UI, state machine and queries are shared.

| Adapter | Use |
|---------|-----|
| `crypto-swap` | Any asset-to-asset swap (USDC↔XMR, …) |
| `goods` | Purchase of a NIP-99 listing (spawned from listing detail) |
| `lightning-btc` | BTC over Lightning |

Funds themselves are moved off-protocol per the adapter's steps (the arbiter
is the trust anchor for custody/disputes); the Nostr layer provides the
signed, tamper-evident coordination and audit trail.

### Queries

- My escrows: `{ kinds: [36797], '#p': [<my-pubkey>] }`
- Contract: `{ kinds: [36797], authors: [<initiator>], '#d': [<d>] }` (author
  filter required — addressable trust boundary)
- Actions: `{ kinds: [1951], '#a': [<coordinates…>] }`

## Direct messages to sellers

From a listing detail, a logged-in buyer can send an end-to-end encrypted
message to the seller ("Pošalji poruku"). Flow (all standard NIPs):

1. **Rumor** — unsigned kind 14 chat message with `p` (seller) and `a`
   (`30402:<seller-pubkey>:<d>`, the listing coordinate) tags, so the
   recipient's client can show which listing the message is about.
2. **Seal** — kind 13, signed by the buyer's signer, content is the rumor
   JSON encrypted with NIP-44 (`signer.nip44.encrypt`). No tags.
3. **Gift wrap** — kind 1059, signed by a one-time ephemeral key generated
   in-browser (`generateSecretKey` + `finalizeEvent`); content is the seal
   JSON encrypted with `nip44.encrypt` using the conversation key between
   the ephemeral key and the seller. Tags: `p` = seller.
4. **Delivery** — published to the app's relay pool plus the seller's
   NIP-65 (kind 10002) read relays, best-effort.

The app only sends messages; replies arrive in the buyer's own Nostr client
(all NIP-59-capable clients render these wraps). The user's private key is
never handled by the app — all user-key operations go through the signer
interface; the ephemeral wrap key is generated locally and discarded.

## Listing schema (kind 30402)

Follows NIP-99 with these tags:

- `d` — unique identifier (slug of the title + random suffix)
- `title` — listing title
- `summary` — optional short description
- `published_at` — unix seconds of first publication
- `t` — category (relay-indexable). Values used by this app:
  `telefoni`, `sim-esim`, `racunari`, `elektronika`, `kripto`, `vozila`,
  `nekretnine`, `namestaj`, `odeca`, `sport`, `ljubimci`, `usluge`, `posao`,
  `besplatno`, `ostalo`
- `price` — `[price, <number>, <currency>, <frequency?>]`, currency in ISO 4217
  or ISO-like code (`RSD`, `EUR`, `USD`, `BTC`), frequency optional
  (`hour`, `day`, `week`, `month`, `year`)
- `location` — free-form location string (e.g. "Beograd")
- `status` — `active` or `sold` (re-publishing with the same `d` updates the listing)
- `image` — NIP-99 image tag (`[image, <url>, <dimensions?>]`), urls are https-only
- `imeta` — NIP-94 file metadata per image (from Blossom upload)
- `alt` — NIP-31 human-readable summary for clients that don't render listings

### Extension tags

- `condition` — optional item condition: `novo` (new) or `polovno` (used).
  This is a domain-specific addition on top of NIP-99 ("other tags may be
  added as necessary"). Unknown to other clients, safely ignored.

## Queries (listings)

- Feed: `{ kinds: [30402], limit: 200 }` with optional `#t` category filter at the relay level.
- User listings: `{ kinds: [30402], authors: [<pubkey>] }`.
- Single listing: `{ kinds: [30402], authors: [<pubkey>], '#d': [<identifier>] }` —
  author filtering is required for addressable events (the `d` tag alone is not
  a trust boundary).

## Rendering

- Listing details are routed via NIP-19 `naddr` at the URL root (`/:nip19`), rendered by `ListingDetail`.
- All event-sourced image URLs pass through `sanitizeUrl()` (https-only allowlist) before rendering.
- Listing descriptions render as plain paragraphs (split on blank lines); no HTML is injected.
