import type { RelayMetadata } from '@/contexts/AppContext';

/**
 * App default relays. Used as the initial `relayMetadata` for new users and as
 * a fallback when the user has no NIP-65 relay list configured (e.g. during
 * nostrconnect handshakes before any user relays have been loaded).
 *
 * NOTE: relay.dreamith.to was replaced by relay.damus.io — dreamith has been
 * unreachable (verified), leaving the app with a single read relay that does
 * not serve custom kinds. damus.io is a live generic relay that accepts all
 * kinds. Existing persisted configs are migrated by `migrateRelayMetadata`.
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
    { url: 'wss://relay.damus.io/', read: true, write: true },
    { url: 'wss://relay.primal.net/', read: false, write: true },
    { url: 'wss://nos.lol/', read: false, write: true },
  ],
  updatedAt: 0,
};

/** Dead relay → live replacement (verified unreachable). */
const DEAD_RELAY = 'wss://relay.dreamith.to/';
const DEAD_RELAY_REPLACEMENT = 'wss://relay.damus.io/';

function normalize(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * One-way migration for persisted relay lists (localStorage configs and
 * stale NIP-65 lists): replaces the dead relay with the live generic one so
 * every session keeps two working read relays. Pure — never rewrites storage.
 */
export function migrateRelayMetadata(metadata: RelayMetadata): RelayMetadata {
  const hasDead = metadata.relays.some((relay) => normalize(relay.url) === normalize(DEAD_RELAY));
  if (!hasDead) return metadata;

  const alreadyHasReplacement = metadata.relays.some(
    (relay) => normalize(relay.url) === normalize(DEAD_RELAY_REPLACEMENT),
  );

  const relays = metadata.relays.map((relay) =>
    normalize(relay.url) === normalize(DEAD_RELAY)
      ? { ...relay, url: alreadyHasReplacement ? '' : DEAD_RELAY_REPLACEMENT }
      : relay,
  ).filter((relay) => relay.url !== '');

  return { ...metadata, relays };
}
