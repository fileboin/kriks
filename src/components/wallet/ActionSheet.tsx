import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Hourglass } from 'lucide-react';

/**
 * Phase-1 placeholder sheet for Send / Receive / Swap actions.
 * Real flows arrive with their phases (P2 BTC on-chain, P3 Lightning,
 * P4 USDT, P5 swap) — the shell keeps the interaction plumbing ready.
 */
export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Phase in which this action becomes real. */
  phase: number;
}

export function ActionSheet({ open, onOpenChange, title, description, phase }: ActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hourglass className="size-5 text-primary" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Ova funkcija se aktivira u <strong>fazi {phase}</strong> projekta. Interfejs je
          spreman — adapter se uključuje bez promene dizajna.
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Razumem</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
