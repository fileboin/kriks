import { useMemo } from 'react';

import { listVisibleAssetIds, listWalletAdapters } from '@/lib/wallet/registry';
import type { WalletAdapter, WalletAssetId } from '@/lib/wallet/core';

export interface UseWalletAssetsResult {
  /** Registered adapters (empty in Phase 1). */
  assets: WalletAdapter[];
  /** Asset ids visible in the UI, flag-gated. */
  visibleIds: WalletAssetId[];
  /** Whether any real adapter is plugged in yet. */
  hasAdapters: boolean;
}

/**
 * The wallet UI's single source of asset state. Phase 1: shell only —
 * adapters arrive in Phases 2–4 and light the UI up without UI changes.
 */
export function useWalletAssets(): UseWalletAssetsResult {
  return useMemo(
    () => ({
      assets: listWalletAdapters(),
      visibleIds: listVisibleAssetIds(),
      hasAdapters: listWalletAdapters().length > 0,
    }),
    [],
  );
}
