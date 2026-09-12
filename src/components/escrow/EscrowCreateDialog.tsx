import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { ESCROW_ADAPTERS, getEscrowAdapter, type EscrowField } from '@/lib/escrow/adapters';
import { ESCROW_KIND } from '@/lib/escrow/types';
import {
  escrowPath,
  generateEscrowId,
  parsePubkeyInput,
  shortNpub,
} from '@/lib/escrow/core';
import { Loader2, ShieldCheck } from 'lucide-react';

export interface EscrowPreset {
  adapterId: string;
  terms: Record<string, string>;
  /** The counterparty this escrow is created against (e.g. the listing author). */
  counterpartyPubkey: string;
  counterpartyLabel: string;
  /** Role of the logged-in creator. */
  myRole: 'buyer' | 'seller';
  listingCoordinate?: string;
}

export interface EscrowCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the form is pre-filled from a listing and locked to its adapter. */
  preset?: EscrowPreset;
}

const EXPIRY_OPTIONS = [
  { value: '86400', label: '1 dan' },
  { value: '259200', label: '3 dana' },
  { value: '604800', label: '7 dana' },
  { value: '2592000', label: '30 dana' },
];

export function EscrowCreateDialog({ open, onOpenChange, preset }: EscrowCreateDialogProps) {
  const { user } = useCurrentUser();
  const { mutateAsync: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [adapterId, setAdapterId] = useState(preset?.adapterId ?? 'crypto-swap');
  const [myRole, setMyRole] = useState<'buyer' | 'seller'>(preset?.myRole ?? 'buyer');
  const [counterparty, setCounterparty] = useState(
    preset ? shortNpub(preset.counterpartyPubkey) : '',
  );
  const [arbiter, setArbiter] = useState('');
  const [expiry, setExpiry] = useState('604800');
  const [terms, setTerms] = useState<Record<string, string>>(preset?.terms ?? {});

  const adapter = getEscrowAdapter(adapterId);

  // Reset each time the dialog opens.
  useEffect(() => {
    if (open) {
      setAdapterId(preset?.adapterId ?? 'crypto-swap');
      setMyRole(preset?.myRole ?? 'buyer');
      setCounterparty(preset ? shortNpub(preset.counterpartyPubkey) : '');
      setArbiter('');
      setExpiry('604800');
      setTerms(preset?.terms ?? {});
    }
  }, [open, preset]);

  const counterpartyPubkey = preset ? preset.counterpartyPubkey : parsePubkeyInput(counterparty);
  const arbiterPubkey = parsePubkeyInput(arbiter);

  const fieldsValid = useMemo(() => {
    if (!adapter) return false;
    return adapter.fields
      .filter((field) => field.required)
      .every((field) => (terms[field.name] ?? '').trim().length > 0);
  }, [adapter, terms]);

  const formValid =
    Boolean(user) &&
    Boolean(adapter) &&
    fieldsValid &&
    counterpartyPubkey !== undefined &&
    arbiterPubkey !== undefined &&
    arbiterPubkey !== user?.pubkey &&
    counterpartyPubkey !== user?.pubkey &&
    arbiterPubkey !== counterpartyPubkey &&
    !isPending;

  const setTerm = (field: EscrowField, value: string) => {
    setTerms((prev) => ({ ...prev, [field.name]: value }));
  };

  const switchAdapter = (id: string) => {
    setAdapterId(id);
    // Re-fill from preset when returning to the preset adapter.
    const next = id === preset?.adapterId ? (preset?.terms ?? {}) : {};
    setTerms(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !adapter || !formValid || !counterpartyPubkey || !arbiterPubkey) return;

    const d = generateEscrowId();
    const buyer = myRole === 'buyer' ? user.pubkey : counterpartyPubkey;
    const seller = myRole === 'seller' ? user.pubkey : counterpartyPubkey;

    const tags: string[][] = [
      ['d', d],
      // Ordered participants — [buyer, seller, arbiter] (see NIP.md).
      ['p', buyer],
      ['p', seller],
      ['p', arbiterPubkey],
      ['t', adapter.id],
      ['expiration', String(Math.floor(Date.now() / 1000) + Number(expiry))],
    ];
    if (preset?.listingCoordinate) tags.push(['a', preset.listingCoordinate]);
    tags.push(['alt', `Escrow predlog: ${adapter.summary(terms)} uz arbitra.`]);

    try {
      await createEvent({ kind: ESCROW_KIND, content: JSON.stringify(terms), tags });
      await queryClient.invalidateQueries({ queryKey: ['escrow'] });
      toast({
        title: 'Escrow predlog je objavljen',
        description: 'Čeka da druga strana prihvati uslove.',
      });
      onOpenChange(false);
      navigate(escrowPath({ initiator: user.pubkey, d }));
    } catch (error) {
      console.error('Failed to create escrow:', error);
      toast({
        title: 'Greška pri objavljivanju escrow-a',
        description: 'Proveri konekciju i pokušaj ponovo.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {!user ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                Novi escrow
              </DialogTitle>
              <DialogDescription>
                Escrow zahteva Nostr nalog — ugovor i sve akcije su potpisane tvojim ključem.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <LoginArea className="flex" />
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" aria-hidden />
                Novi escrow
              </DialogTitle>
              <DialogDescription>
                Jemčeni ugovor na Nostr-u: uslovi, učesnici i arbitar — sve potpisano,
                stanje se vodi kroz javne akcije.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="escrow-adapter">Tip trejda</Label>
                <Select value={adapterId} onValueChange={switchAdapter} disabled={Boolean(preset)}>
                  <SelectTrigger id="escrow-adapter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCROW_ADAPTERS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {adapter && <p className="text-xs text-muted-foreground">{adapter.description}</p>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="escrow-role">Ja sam</Label>
                  <Select
                    value={myRole}
                    onValueChange={(v) => setMyRole(v as 'buyer' | 'seller')}
                    disabled={Boolean(preset)}
                  >
                    <SelectTrigger id="escrow-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Kupac</SelectItem>
                      <SelectItem value="seller">Prodavac</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="escrow-expiry">Važi (prihvatanje)</Label>
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger id="escrow-expiry" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="escrow-counterparty">
                  {myRole === 'buyer' ? 'Prodavac' : 'Kupac'} (npub)
                </Label>
                {preset ? (
                  <Input id="escrow-counterparty" value={counterparty} disabled />
                ) : (
                  <Input
                    id="escrow-counterparty"
                    placeholder="npub1…"
                    value={counterparty}
                    onChange={(e) => setCounterparty(e.target.value)}
                    aria-invalid={counterparty.trim().length > 0 && !counterpartyPubkey}
                  />
                )}
                {preset && (
                  <p className="text-xs text-muted-foreground">{preset.counterpartyLabel}</p>
                )}
                {!preset && counterparty.trim().length > 0 && !counterpartyPubkey && (
                  <p className="text-xs text-destructive">Unesi validan npub ili hex pubkey.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="escrow-arbiter">Arbitar (npub) *</Label>
                <Input
                  id="escrow-arbiter"
                  placeholder="npub1… — osoba od poverenja kojoj se veruju obe strane"
                  value={arbiter}
                  onChange={(e) => setArbiter(e.target.value)}
                  aria-invalid={arbiter.trim().length > 0 && !arbiterPubkey}
                />
                {arbiter.trim().length > 0 && !arbiterPubkey && (
                  <p className="text-xs text-destructive">Unesi validan npub ili hex pubkey.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Arbitar drži/pušta sredstva i presudjuje u sporu. Obe strane moraju
                  verovati istoj osobi — izaberite neko od poverenja (npr. poznati član
                  zajednice sa verifikovanim NIP-05).
                </p>
              </div>

              {adapter && (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Uslovi trejda</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {adapter.fields.map((field) => (
                      <div
                        key={field.name}
                        className={field.name === 'note' ? 'space-y-2 sm:col-span-2' : 'space-y-2'}
                      >
                        <Label htmlFor={`escrow-${field.name}`}>
                          {field.label}
                          {field.required && ' *'}
                        </Label>
                        {field.name === 'note' ? (
                          <Textarea
                            id={`escrow-${field.name}`}
                            rows={2}
                            placeholder={field.placeholder}
                            value={terms[field.name] ?? ''}
                            onChange={(e) => setTerm(field, e.target.value)}
                          />
                        ) : (
                          <Input
                            id={`escrow-${field.name}`}
                            inputMode={field.type === 'number' ? 'decimal' : undefined}
                            placeholder={field.placeholder}
                            value={terms[field.name] ?? ''}
                            onChange={(e) => setTerm(field, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-5 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Otkaži
              </Button>
              <Button type="submit" className="gap-1.5" disabled={!formValid}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Objavljujem…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" aria-hidden />
                    Predloži escrow
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
