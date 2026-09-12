import { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useQueryClient } from '@tanstack/react-query';

import { EscrowTimeline } from '@/components/escrow/EscrowTimeline';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useEscrowDetail } from '@/hooks/useEscrow';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { getEscrowAdapter } from '@/lib/escrow/adapters';
import {
  VERB_LABELS,
  escrowProgress,
  escrowRoleOf,
  nextEscrowActions,
  shortNpub,
  type EscrowNextAction,
} from '@/lib/escrow/core';
import {
  ESCROW_ACTION_KIND,
  type EscrowAction,
  type EscrowRole,
  type EscrowState,
} from '@/lib/escrow/types';
import { sanitizeUrl, timeAgo } from '@/lib/listings';
import { cn } from '@/lib/utils';

import {
  ArrowLeft,
  Coins,
  FileClock,
  Gavel,
  Loader2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

function PartyChip({
  pubkey,
  role,
  isViewer,
}: {
  pubkey: string;
  role: EscrowRole;
  isViewer: boolean;
}) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const displayName = metadata?.display_name ?? metadata?.name ?? 'Nepoznat';
  const picture = metadata?.picture ? sanitizeUrl(metadata.picture) : undefined;
  const npub = nip19.npubEncode(pubkey);

  const roleLabel = role === 'buyer' ? 'Kupac' : role === 'seller' ? 'Prodavac' : 'Arbitar';

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar>
        {picture && <AvatarImage src={picture} alt={displayName} />}
        <AvatarFallback>
          <UserRound className="size-4" aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="truncate">{displayName}</span>
          {isViewer && (
            <Badge className="rounded-full text-[10px]">ti</Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {roleLabel} · {shortNpub(pubkey)}
        </p>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/${npub}`}>Profil</Link>
      </Button>
    </div>
  );
}

const TRAIL_ICONS: Record<string, typeof ShieldCheck> = {
  accept: ShieldCheck,
  decline: Gavel,
  fund: Coins,
  deliver: FileClock,
  release: ShieldCheck,
  dispute: Gavel,
  resolve: Gavel,
};

function TrailRow({ action, contract }: { action: EscrowAction; contract: EscrowState['contract'] }) {
  const author = useAuthor(action.author);
  const metadata = author.data?.metadata;
  const displayName = metadata?.display_name ?? metadata?.name ?? shortNpub(action.author);
  const role = escrowRoleOf(contract, action.author) ?? 'posmatrač';
  const roleLabel = role === 'buyer' ? 'kupac' : role === 'seller' ? 'prodavac' : role === 'arbiter' ? 'arbitar' : role;
  const Icon = TRAIL_ICONS[action.verb] ?? ShieldCheck;

  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border bg-muted/50">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 border-b pb-4">
        <p className="text-sm">
          <span className="font-medium">{displayName}</span>
          <span className="text-muted-foreground">
            {' '}
            ({roleLabel}) je {VERB_LABELS[action.verb]}
            {action.verb === 'resolve' && action.outcome === 'refund' && ' — refundacija kupcu'}
            {action.verb === 'resolve' && action.outcome === 'release' && ' — isplata prodavcu'}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{timeAgo(action.createdAt)}</p>
        {action.note && (
          <p className="mt-2 rounded-lg border bg-muted/40 p-2.5 font-mono text-xs break-all">
            {action.note}
          </p>
        )}
      </div>
    </li>
  );
}

export interface EscrowDetailProps {
  /** Initiator (author) pubkey of the escrow contract. */
  initiator: string;
  /** `d` tag identifier. */
  identifier: string;
}

export function EscrowDetail({ initiator, identifier }: EscrowDetailProps) {
  const { data: state, isPending, isError } = useEscrowDetail(initiator, identifier);
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent, isPending: isActing } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAction, setSelectedAction] = useState<EscrowNextAction | null>(null);
  const [note, setNote] = useState('');

  if (isPending) {
    return (
      <div className="container max-w-3xl space-y-5 py-8">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !state) {
    return (
      <div className="container max-w-2xl py-16">
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground/60" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold">Escrow nije pronađen</h1>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Ugovor je možda obrisan ili relay serveri još nisu odgovorili.
            </p>
            <Button className="mt-6 rounded-full" asChild>
              <Link to="/escrow">
                <ArrowLeft className="size-4" aria-hidden />
                Svi escrow
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contract } = state;
  const adapter = getEscrowAdapter(contract.adapterId);
  const viewerRole = user ? escrowRoleOf(contract, user.pubkey) : undefined;
  const actions = nextEscrowActions(state, user?.pubkey);

  const performAction = async () => {
    if (!selectedAction || !user) return;

    const tags: string[][] = [
      ['a', contract.coordinate],
      ['e', contract.event.id],
      ['p', contract.buyer],
      ['p', contract.seller],
      ['p', contract.arbiter],
      ['verb', selectedAction.verb],
    ];
    if (selectedAction.outcome) tags.push(['outcome', selectedAction.outcome]);
    tags.push(['alt', `Escrow akcija: ${selectedAction.verb}`]);

    try {
      await createEvent({
        kind: ESCROW_ACTION_KIND,
        content: note.trim(),
        tags,
      });
      await queryClient.invalidateQueries({ queryKey: ['escrow'] });
      toast({ title: 'Akcija je objavljena', description: selectedAction.label });
      setSelectedAction(null);
      setNote('');
    } catch (error) {
      console.error('Escrow action failed:', error);
      toast({
        title: 'Greška pri objavljivanju akcije',
        variant: 'destructive',
      });
    }
  };

  const steps =
    viewerRole === 'buyer'
      ? adapter?.buyerSteps(contract.terms) ?? []
      : viewerRole === 'seller'
        ? adapter?.sellerSteps(contract.terms) ?? []
        : viewerRole === 'arbiter'
          ? [
              'Prati stanje escrow-a i dokaze učitane u trag ispod.',
              'Ako dođe do spora, presudi akcijom "Presudi" — refundacija kupcu ili isplata prodavcu.',
            ]
          : [];

  return (
    <div className="container max-w-3xl space-y-6 py-8">
      <Link
        to="/escrow"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Svi escrow
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full gap-1">
            <ShieldCheck className="size-3" aria-hidden />
            {adapter?.label ?? contract.adapterId}
          </Badge>
          {contract.listingCoordinate && (
            <Badge variant="secondary" className="rounded-full">
              iz oglasa
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">
          {adapter?.summary(contract.terms) ?? 'Escrow trejd'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Predložio {shortNpub(contract.initiator)} · {timeAgo(contract.createdAt)}
        </p>
      </div>

      {/* Timeline */}
      <Card>
        <CardContent className="p-6">
          <EscrowTimeline status={state.status} progress={escrowProgress(state)} />
        </CardContent>
      </Card>

      {/* Viewer actions */}
      {actions.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Tvoja sledeća akcija</CardTitle>
            <CardDescription>
              {viewerRole === 'buyer' && 'Kao kupac'}
              {viewerRole === 'seller' && 'Kao prodavac'}
              {viewerRole === 'arbiter' && 'Kao arbitar'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={`${action.verb}-${action.outcome ?? ''}`}
                variant={action.destructive ? 'destructive' : action.verb === 'accept' ? 'default' : 'outline'}
                className="gap-1.5"
                disabled={isActing}
                onClick={() => {
                  setSelectedAction(action);
                  setNote('');
                }}
              >
                {action.verb === 'accept' && <ShieldCheck className="size-4" aria-hidden />}
                {action.verb === 'resolve' && <Gavel className="size-4" aria-hidden />}
                {action.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Terms */}
      {adapter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Uslovi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {adapter.fields.map((field) => {
              const value = contract.terms[field.name];
              if (!value) return null;
              return (
                <div key={field.name} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="mt-0.5 text-sm font-medium break-words">{value}</p>
                </div>
              );
            })}
            {contract.expiration !== undefined && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Ponuda važi do</p>
                <p className="mt-0.5 text-sm font-medium">
                  {new Date(contract.expiration * 1000).toLocaleString('sr-RS')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      {steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kako se odvija trejd</CardTitle>
            <CardDescription>
              {viewerRole === 'arbiter' ? 'Uloga arbitra' : 'Tvoji koraci'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {steps.map((text, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{text}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Parties */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Učesnici</CardTitle>
          <CardDescription>Ugovor obavezuje potpisane učesnike i njihovog arbitra.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <PartyChip pubkey={contract.buyer} role="buyer" isViewer={user?.pubkey === contract.buyer} />
          <PartyChip pubkey={contract.seller} role="seller" isViewer={user?.pubkey === contract.seller} />
          <PartyChip pubkey={contract.arbiter} role="arbiter" isViewer={user?.pubkey === contract.arbiter} />
        </CardContent>
      </Card>

      {/* Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trag akcija (auditorija)</CardTitle>
          <CardDescription>
            Svaka akcija je poseban potpisan Nostr događaj — niko ne može da ih menja nakon objave.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.trail.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Još nema akcija — čeka se odgovor druge strane.
            </p>
          ) : (
            <ul className="-mb-4">
              {state.trail.map((action) => (
                <TrailRow key={action.event.id} action={action} contract={contract} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Action note dialog */}
      <Dialog open={selectedAction !== null} onOpenChange={(open) => !open && setSelectedAction(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedAction && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAction.label}</DialogTitle>
                <DialogDescription>
                  {selectedAction.requiresNote
                    ? 'Opciono nalepi dokaz (txid, hash, invoice…) — biće javno vidljivo u trag akcija.'
                    : 'Akcija se objavljuje kao potpisan Nostr događaj i ne može se poništiti.'}
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={3}
                placeholder="npr. txid: 5f2a… ili invoice: lnbc…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
              />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedAction(null)}>
                  Otkaži
                </Button>
                <Button
                  className={cn(selectedAction.destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                  onClick={() => void performAction()}
                  disabled={isActing}
                >
                  {isActing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  Potvrdi
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
