import type { LucideIcon } from 'lucide-react';
import { ArrowDownLeft, ArrowUpRight, Clock, History } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WalletTransaction } from '@/lib/wallet/core';
import { sanitizeUrl, timeAgo } from '@/lib/listings';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<WalletTransaction['status'], string> = {
  pending: 'u toku',
  confirmed: 'potvrđeno',
  failed: 'neuspešno',
};

const STATUS_CLASSES: Record<WalletTransaction['status'], string> = {
  pending: 'text-amber-300',
  confirmed: 'text-emerald-300',
  failed: 'text-red-300',
};

function TxRow({ tx }: { tx: WalletTransaction }) {
  const isIn = tx.direction === 'in';
  const Icon: LucideIcon = isIn ? ArrowDownLeft : ArrowUpRight;
  const explorerUrl = tx.explorerUrl ? sanitizeUrl(tx.explorerUrl) : undefined;

  return (
    <li className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          isIn ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', isIn ? 'text-green-400' : 'text-red-400')}>
          {tx.amountText}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.description ?? '—'}
          {tx.feeText ? ` · naknada ${tx.feeText}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-xs font-medium', STATUS_CLASSES[tx.status])}>
          {STATUS_LABELS[tx.status]}
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(tx.timestamp)}</p>
      </div>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Detalji
        </a>
      )}
    </li>
  );
}

/** Bro-style transaction history list (empty state in Phase 1). */
export interface TxHistoryProps {
  transactions: WalletTransaction[];
  emptyHint?: string;
}

export function TxHistory({ transactions, emptyHint }: TxHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-muted-foreground" aria-hidden />
          Istorija transakcija
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Clock className="size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">Nema transakcija</p>
            {emptyHint && <p className="max-w-xs text-xs text-muted-foreground/70">{emptyHint}</p>}
          </div>
        ) : (
          <ul>
            {transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
