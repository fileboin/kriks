/**
 * Wallet core — provider-agnostic types and asset metadata.
 *
 * The UI talks only to this interface (via the registry); concrete adapters
 * (BTC on-chain, Spark Lightning, NWC, Spark USDT, swaps) are plugged in
 * phase by phase and never referenced from UI components directly.
 *
 * Phase 1 ships ONLY types + metadata — no signing, no seeds, no transfers.
 */

/** Asset identifiers. `usdb` stays behind a feature flag (locked decision). */
export type WalletAssetId = 'btc-onchain' | 'lightning' | 'usdt' | 'usdb';

/** Adapter lifecycle state for the current session. */
export type WalletAdapterStatus = 'coming-soon' | 'locked' | 'ready' | 'unsupported';

/** Balance snapshot of one asset, as displayed on the Bro-style balance card. */
export interface AssetBalance {
  assetId: WalletAssetId;
  /** Primary display amount, e.g. "12 345 sats" or "25,00 USDT". */
  amountText: string;
  /** Reference lines under the amount, e.g. "≈ 0.00012345 BTC", "≈ $12.34". */
  references: string[];
  /** Amount locked/in-flight (e.g. pending payments), e.g. "500 sats". */
  lockedText?: string;
}

export type WalletTxStatus = 'pending' | 'confirmed' | 'failed';
export type WalletTxDirection = 'in' | 'out';

/** A wallet transaction row (history list). */
export interface WalletTransaction {
  id: string;
  assetId: WalletAssetId;
  direction: WalletTxDirection;
  /** Signed display amount, e.g. "+250 sats" / "−10,00 USDT". */
  amountText: string;
  feeText?: string;
  status: WalletTxStatus;
  /** Unix seconds. */
  timestamp: number;
  /** Memo / counterparty hint. */
  description?: string;
  /** Optional explorer URL — must pass sanitizeUrl() at render time. */
  explorerUrl?: string;
}

/**
 * Where a marketplace payment goes. Destinations are resolved in
 * Phase 6 (listing → asset → destination); the type exists from day one
 * so adapters are built payment-aware without later refactors.
 */
export type PaymentDestination =
  | { type: 'btc-onchain'; address: string; /** Seller pubkey the address was derived from. */ pubkey: string }
  | { type: 'lightning'; invoice: string }
  | { type: 'spark-token'; sparkAddress: string; tokenId: string };

export interface ReceiveRequest {
  /** QR payload (BIP-21 / lightning: / spark invoice URI). */
  uri: string;
  /** Human-readable address/invoice string for copy. */
  display: string;
}

export interface ReceiveParams {
  amount?: string;
  memo?: string;
}

export interface SendParams {
  destination: string | PaymentDestination;
  amount: string;
  memo?: string;
}

/**
 * A wallet asset adapter. Implemented per provider in later phases
 * (bitcoin-onchain, lightning-spark, lightning-nwc, spark-usdt, swap).
 */
export interface WalletAdapter {
  id: WalletAssetId;
  label: string;
  description: string;
  status: WalletAdapterStatus;
  getBalance(): Promise<AssetBalance>;
  getHistory(limit?: number): Promise<WalletTransaction[]>;
  createReceiveRequest(params: ReceiveParams): Promise<ReceiveRequest>;
  send(params: SendParams): Promise<WalletTransaction>;
}

/** Static metadata for every asset — drives tabs and shell copy. */
export const WALLET_ASSET_META: Record<
  WalletAssetId,
  { label: string; description: string; phase: number }
> = {
  'btc-onchain': {
    label: 'BTC On-chain',
    description: 'Bitcoin na glavnom lancu — adresa izvedena direktno iz tvog Nostr ključa.',
    phase: 2,
  },
  lightning: {
    label: 'Lightning',
    description: 'Instant Bitcoin preko Lightning mreže — Spark kao primarni layer, NWC za eksterne wallet-e.',
    phase: 3,
  },
  usdt: {
    label: 'USDT',
    description: 'USDT stablecoin, nativno izdat na Spark-u (izdavač: Tether).',
    phase: 4,
  },
  usdb: {
    label: 'USDB',
    description: 'USDB stablecoin (Brale/Flashnet) — eksperimentalno, iza feature flag-a.',
    phase: 4,
  },
};
