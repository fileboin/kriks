import { Check } from 'lucide-react';

import { STATUS_LABELS, TIMELINE } from '@/lib/escrow/core';
import type { EscrowStatus } from '@/lib/escrow/types';
import { cn } from '@/lib/utils';

export interface EscrowTimelineProps {
  status: EscrowStatus;
  /** 0–4: how far the happy path progressed (see escrowProgress). */
  progress: number;
}

const OVERRIDES: Partial<Record<EscrowStatus, string>> = {
  disputed: 'Spor u toku — arbitar presudjuje',
  refunded: 'Završeno refundacijom kupcu',
  declined: 'Odbijeno od strane druge strane',
  expired: 'Ponuda je istekla',
};

export function EscrowTimeline({ status, progress }: EscrowTimelineProps) {
  const done = status === 'released';

  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Napredak escrow-a">
        {TIMELINE.map((step, i) => {
          const isDone = done || i < progress;
          const isCurrent = !done && i === progress && status !== 'refunded' && status !== 'declined' && status !== 'expired';
          return (
            <li key={step.status} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <div className="flex w-full items-center">
                <span
                  aria-hidden
                  className={cn('h-0.5 flex-1 rounded', i === 0 ? 'bg-transparent' : isDone || i <= progress ? 'bg-primary' : 'bg-border')}
                />
                <span
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-colors',
                    isDone
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isCurrent
                        ? 'border-primary text-primary'
                        : i < progress
                          ? 'border-primary/60 bg-primary/20 text-primary'
                          : 'border-border text-muted-foreground',
                  )}
                >
                  {isDone || i < progress ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  aria-hidden
                  className={cn('h-0.5 flex-1 rounded', i === TIMELINE.length - 1 ? 'bg-transparent' : i < progress ? 'bg-primary' : 'bg-border')}
                />
              </div>
              <span
                className={cn(
                  'text-[11px] leading-tight sm:text-xs',
                  isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-center text-sm font-medium" aria-live="polite">
        {status === 'released' || status === 'active' || status === 'funded' || status === 'delivered' || status === 'proposed' ? (
          <span className="text-muted-foreground">
            Status: <span className="text-foreground">{STATUS_LABELS[status]}</span>
          </span>
        ) : (
          <span
            className={cn(
              'inline-block rounded-full border px-3 py-1 text-xs font-medium',
              status === 'disputed' && 'border-red-500/40 bg-red-500/15 text-red-300',
              status === 'refunded' && 'border-sky-500/40 bg-sky-500/15 text-sky-300',
              (status === 'declined' || status === 'expired') && 'border-border bg-muted text-muted-foreground',
            )}
          >
            {OVERRIDES[status]}
          </span>
        )}
      </p>
    </div>
  );
}
