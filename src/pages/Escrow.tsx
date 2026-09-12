import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';

import { EscrowCreateDialog } from '@/components/escrow/EscrowCreateDialog';
import { LoginArea } from '@/components/auth/LoginArea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyEscrowStates } from '@/hooks/useEscrow';
import { getEscrowAdapter } from '@/lib/escrow/adapters';
import {
  STATUS_LABELS,
  escrowPath,
  escrowRoleOf,
} from '@/lib/escrow/core';
import type { EscrowStatus } from '@/lib/escrow/types';
import { cn } from '@/lib/utils';

import { Plus, ShieldCheck } from 'lucide-react';

function StatusBadge({ status }: { status: EscrowStatus }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        status === 'released' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        status === 'refunded' && 'border-sky-500/40 bg-sky-500/15 text-sky-300',
        status === 'disputed' && 'border-red-500/40 bg-red-500/15 text-red-300',
        (status === 'active' || status === 'funded' || status === 'delivered') &&
          'border-amber-500/40 bg-amber-500/15 text-amber-300',
        (status === 'proposed' || status === 'declined' || status === 'expired') &&
          'border-border bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const ROLE_LABELS = { buyer: 'Kupac', seller: 'Prodavac', arbiter: 'Arbitar' } as const;

const EscrowPage = () => {
  useSeoMeta({
    title: 'Escrow — Oglasnik',
    description: 'Jemčeni (escrow) trejdovi na Nostr-u — jezgro sa adapterima za sve tipove razmene.',
  });

  const { user } = useCurrentUser();
  const { states, isPending, isError } = useMyEscrowStates();
  const [createOpen, setCreateOpen] = useState(false);

  if (!user) {
    return (
      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 px-6 py-10">
            <ShieldCheck className="mx-auto size-10 text-primary" aria-hidden />
            <h1 className="text-2xl font-bold">Escrow na Nostr-u</h1>
            <p className="text-sm text-muted-foreground">
              Jemčeni ugovor između kupca, prodavca i arbitra — sve potpisano tvojim
              Nostr ključem. Prijavi se da započneš ili pregledaš trejdove.
            </p>
            <LoginArea className="flex justify-center" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Escrow trejdovi</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Kupac, prodavac i arbitar — tri potpisana učesnika. Sredstva se puštaju
            samo uz saglasnost, a spor rešava arbitar. Jezgro podržava sve tipove
            razmene preko adaptera (kripto zamene, artikli, Lightning…).
          </p>
        </div>
        <Button className="rounded-full" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          Novi escrow
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <p className="mx-auto max-w-sm text-muted-foreground">
              Greška pri učitavanju escrow-a. Proveri konekciju i pokušaj ponovo.
            </p>
          </CardContent>
        </Card>
      ) : states.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground/60" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold">Još nemaš escrow trejdove</h2>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              Započni escrow sa bilo kim — npr. "prodajem USDC za XMR", kupovina iz
              oglasa uz jemca, ili sats preko Lightning-a.
            </p>
            <Button className="mt-5 rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Započni prvi escrow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {states.map(({ state, contract }) => {
            const adapter = getEscrowAdapter(contract.adapterId);
            const role = escrowRoleOf(contract, user.pubkey);
            return (
              <Link
                key={contract.event.id}
                to={escrowPath(contract)}
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <Card className="py-5 transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {adapter?.summary(contract.terms) ?? 'Escrow trejd'}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="rounded-full text-[10px]">
                          {adapter?.label ?? contract.adapterId}
                        </Badge>
                        {role && <span>tvoja uloga: {ROLE_LABELS[role]}</span>}
                      </div>
                    </div>
                    <StatusBadge status={state.status} />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <EscrowCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default EscrowPage;
