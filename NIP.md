# NIP.md

This project implements **Oglasnik** — a Serbian-language classifieds board (oglasna tabla) on Nostr.

## Kinds used

All kinds are standard. No custom kinds are defined.

| Kind | NIP | Purpose |
|------|-----|---------|
| 30402 | [NIP-99](https://github.com/nostr-protocol/nips/blob/master/99.md) | Classified listing (active) |
| 5 | [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) | Listing deletion (`e` + `a` tags) |
| 14 | [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private chat message (rumor, inside gift wrap) |
| 13 | [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Seal wrapping the chat message rumor |
| 1059 | [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift wrap (ephemeral key) delivering the sealed message |

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
  `telefoni`, `racunari`, `elektronika`, `vozila`, `nekretnine`, `namestaj`,
  `odeca`, `sport`, `ljubimci`, `usluge`, `posao`, `besplatno`, `ostalo`
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

## Queries

- Feed: `{ kinds: [30402], limit: 200 }` with optional `#t` category filter at the relay level.
- User listings: `{ kinds: [30402], authors: [<pubkey>] }`.
- Single listing: `{ kinds: [30402], authors: [<pubkey>], '#d': [<identifier>] }` —
  author filtering is required for addressable events (the `d` tag alone is not
  a trust boundary).

## Rendering

- Listing details are routed via NIP-19 `naddr` at the URL root (`/:nip19`), rendered by `ListingDetail`.
- All event-sourced image URLs pass through `sanitizeUrl()` (https-only allowlist) before rendering.
- Listing descriptions render as plain paragraphs (split on blank lines); no HTML is injected.
