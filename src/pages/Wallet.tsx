import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';

import { ActionSheet } from '@/components/wallet/ActionSheet';
import { AssetTabs } from '@/components/wallet/AssetTabs';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { TxHistory } from '@/components/wallet/TxHistory';
import { WalletActions } from '@/components/wallet/WalletActions';
import { useWalletAssets } from '@/hooks/wallet/useWalletAssets';
import { WALLET_ASSET_META, type WalletAssetId } from '@/lib/wallet/core';

import { Bitcoin, Coins, Wallet as WalletIcon, Zap, type LucideIcon } from 'lucide-react';

const ASSET_ICONS: Record<WalletAssetId, LucideIcon> = {
  'btc-onchain': Bitcoin,
  lightning: Zap,
  usdt: Coins,
  usdb: Coins,
};

/** Shell balance values per asset (Phase 1 — no adapters connected yet). */
function shellBalance(assetId: WalletAssetId): {
  label: string;
  amountText: string;
  references: string[];
} {
  switch (assetId) {
    case 'btc-onchain':
      return {
        label: 'Saldo — BTC On-chain',
        amountText: '0 sats',
        references: ['≈ 0.00000000 BTC', '≈ $0.00'],
      };
    case 'lightning':
      return {
        label: 'Saldo — Lightning',
        amountText: '0 sats',
        references: ['≈ 0.00000000 BTC', '≈ $0.00'],
      };
    case 'usdt':
    case 'usdb':
      return {
        label: `Saldo — ${WALLET_ASSET_META[assetId].label}`,
        amountText: '0,00',
        references: ['≈ $0.00'],
      };
  }
}

const WalletPage = () => {
  useSeoMeta({
    title: 'Wallet — Oglasnik',
    description: 'Bitcoin, Lightning i USDT wallet — povezan sa oglasima i escrow flow-om.',
  });

  const { visibleIds, hasAdapters } = useWalletAssets();
  const [activeAsset, setActiveAsset] = useState<WalletAssetId>('btc-onchain');
  const [sheet, setSheet] = useState<'send' | 'receive' | 'swap' | null>(null);

  const meta = WALLET_ASSET_META[activeAsset];
  const balance = shellBalance(activeAsset);
  const Icon = ASSET_ICONS[activeAsset];

  const sheetCopy = {
    send: {
      title: `Pošalji — ${meta.label}`,
      description: `Slanje ${meta.label} asset-a iz wallet-a.`,
      phase: meta.phase,
    },
    receive: {
      title: `Primi — ${meta.label}`,
      description: `Generisanje adrese/invoice-a za primanje ${meta.label}.`,
      phase: meta.phase,
    },
    swap: {
      title: 'Zameni BTC ⇄ USDT',
      description: 'Konverzija između BTC i USDT (parkiranje vrednosti van BTC volatilnosti).',
      phase: 5,
    },
  } as const;

  return (
    <div className="container max-w-2xl py-8 md:py-10">
      {/* Bro AppBar title row: orange wallet icon + bold title */}
      <div className="mb-6 flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-primary-foreground">
          <WalletIcon className="size-5" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      <AssetTabs ids={visibleIds} active={activeAsset} onChange={setActiveAsset} />

      <p className="mt-3 text-sm text-muted-foreground">{meta.description}</p>

      <div className="mt-5 space-y-5">
        <BalanceCard
          icon={Icon}
          label={balance.label}
          amountText={balance.amountText}
          references={balance.references}
          connected={hasAdapters}
        />

        <WalletActions
          onSend={() => setSheet('send')}
          onReceive={() => setSheet('receive')}
          onSwap={() => setSheet('swap')}
        />

        <TxHistory
          transactions={[]}
          emptyHint="Transakcije se prikazuju kad se wallet adapteri povežu (faze 2–4)."
        />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Wallet se aktivira fazno: BTC on-chain (faza 2) → Lightning (faza 3) → USDT (faza 4) →
        swap (faza 5) → plaćanje sa oglasa i escrow (faze 6–7). Sredstva su uvek pod tvojim
        ključevima — nikakav custodial model.
      </p>

      {sheet && (
        <ActionSheet
          open={sheet !== null}
          onOpenChange={(open) => !open && setSheet(null)}
          title={sheetCopy[sheet].title}
          description={sheetCopy[sheet].description}
          phase={sheetCopy[sheet].phase}
        />
      )}
    </div>
  );
};

export default WalletPage;
