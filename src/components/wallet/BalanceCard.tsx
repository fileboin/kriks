import type { LucideIcon } from 'lucide-react';
import { Lock } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Bro-style balance card: amber→orange gradient, 20px radius, 24px padding,
 * soft orange shadow, ⚡-style icon + label, 28px bold amount, muted
 * reference lines (BTC/USD), optional locked badge (white/15 pill).
 */
export interface BalanceCardProps {
  icon: LucideIcon;
  label: string;
  amountText: string;
  references: string[];
  lockedText?: string;
  /** false → small "connects in a later phase" pill (shell state). */
  connected: boolean;
  className?: string;
}

export function BalanceCard({
  icon: Icon,
  label,
  amountText,
  references,
  lockedText,
  connected,
  className,
}: BalanceCardProps) {
  return (
    <div
      className={cn(
        'w-full rounded-[20px] bg-gradient-to-br from-orange-500 to-amber-400 p-6 text-white',
        'shadow-lg shadow-orange-500/25',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-6" aria-hidden />
        <p className="text-sm font-medium">{label}</p>
      </div>

      <p className="mt-3 text-[28px] leading-none font-bold tracking-tight">{amountText}</p>

      {references.map((reference) => (
        <p key={reference} className="mt-1 text-[13px] text-white/70">
          {reference}
        </p>
      ))}

      <div className="mt-4 flex flex-wrap gap-2">
        {lockedText && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs text-white/80">
            <Lock className="size-3.5" aria-hidden />
            {lockedText}
          </span>
        )}
        {!connected && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs text-white/80">
            Povezivanje dolazi u sledećoj fazi
          </span>
        )}
      </div>
    </div>
  );
}
