import type { WalletAdapter, WalletAssetId } from './core';

/**
 * Wallet adapter registry. Adapters register themselves here (from their own
 * modules in later phases); the UI only ever reads from the registry — it is
 * never bound to a concrete provider.
 *
 * Phase 1: the registry is intentionally EMPTY. The shell renders placeholder
 * states; no signing, seeds, or transfers exist yet.
 */

/** Feature flags for assets that are not part of the MVP surface. */
export const WALLET_FEATURE_FLAGS = {
  /** Locked decision: USDB stays hidden until its production flow is confirmed. */
  usdb: false,
} as const;

const adapters = new Map<WalletAssetId, WalletAdapter>();

export function registerWalletAdapter(adapter: WalletAdapter): void {
  adapters.set(adapter.id, adapter);
}

export function getWalletAdapter(id: WalletAssetId): WalletAdapter | undefined {
  return adapters.get(id);
}

export function listWalletAdapters(): WalletAdapter[] {
  return [...adapters.values()];
}

/** Asset ids visible in the wallet UI (flag-gated). */
export function listVisibleAssetIds(): WalletAssetId[] {
  const ids: WalletAssetId[] = ['btc-onchain', 'lightning', 'usdt'];
  if (WALLET_FEATURE_FLAGS.usdb) ids.push('usdb');
  return ids;
}
