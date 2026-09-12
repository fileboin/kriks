import { ArrowDown, ArrowLeftRight, ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Bro-style circular action buttons: Send (red) / Receive (green) / Swap
 * (amber) — tinted 15% background, 30% border, 12px radius, full-color
 * circular icon badge (44px) with the label below.
 */
export interface WalletActionsProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap: () => void;
  className?: string;
}

interface ActionDef {
  icon: typeof ArrowUp;
  label: string;
  color: string;
  onClick: () => void;
}

export function WalletActions({ onSend, onReceive, onSwap, className }: WalletActionsProps) {
  const actions: ActionDef[] = [
    { icon: ArrowUp, label: 'Pošalji', color: 'red', onClick: onSend },
    { icon: ArrowDown, label: 'Primi', color: 'green', onClick: onReceive },
    { icon: ArrowLeftRight, label: 'Zameni', color: 'amber', onClick: onSwap },
  ];

  const colorClasses: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/15',
    green: 'border-green-500/30 bg-green-500/15',
    amber: 'border-amber-500/30 bg-amber-500/15',
  };
  const badgeClasses: Record<string, string> = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className={cn('grid grid-cols-3 gap-3', className)}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border py-4 transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring hover:bg-white/5',
            colorClasses[action.color],
          )}
        >
          <span
            className={cn(
              'grid size-11 place-items-center rounded-full text-white',
              badgeClasses[action.color],
            )}
          >
            <action.icon className="size-6" aria-hidden />
          </span>
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}
