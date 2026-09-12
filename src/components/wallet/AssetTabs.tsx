import { cn } from '@/lib/utils';
import { WALLET_ASSET_META, type WalletAssetId } from '@/lib/wallet/core';

/** Flat asset switcher above the balance card (multi-asset extension of the
 *  Bro wallet layout — the card always shows the selected asset). */
export interface AssetTabsProps {
  ids: WalletAssetId[];
  active: WalletAssetId;
  onChange: (id: WalletAssetId) => void;
  className?: string;
}

export function AssetTabs({ ids, active, onChange, className }: AssetTabsProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="tablist"
      aria-label="Wallet asseti"
    >
      {ids.map((id) => {
        const meta = WALLET_ASSET_META[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
