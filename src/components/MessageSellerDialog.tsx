import { useEffect, useState } from 'react';
import { finalizeEvent, generateSecretKey, getEventHash, nip44 } from 'nostr-tools';

import { useNostr } from '@nostrify/react';

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
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';

import { CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';

export interface MessageSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerPubkey: string;
  listingTitle: string;
  /** Addressable coordinate of the listing ("30402:pubkey:d") for message context. */
  listingCoordinate: string;
}

const MAX_MESSAGE_LENGTH = 1000;

export function MessageSellerDialog({
  open,
  onOpenChange,
  sellerPubkey,
  listingTitle,
  listingCoordinate,
}: MessageSellerDialogProps) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Reset (and prefill) state each time the dialog opens for a seller/listing.
  useEffect(() => {
    if (open) {
      setSent(false);
      setSending(false);
      setMessage(`Zdravo! Interesuje me oglas "${listingTitle}". Da li je još dostupan?`);
    }
  }, [open, sellerPubkey, listingCoordinate, listingTitle]);

  const signerSupportsNip44 = Boolean(user?.signer.nip44);
  const canSend = signerSupportsNip44 && message.trim().length > 0 && !sending && !sent;

  const handleSend = async () => {
    if (!user?.signer.nip44 || !canSend) return;

    setSending(true);
    try {
      const now = Math.floor(Date.now() / 1000);

      // 1. Rumor — unsigned NIP-17 chat message referencing the listing.
      const rumorTemplate = {
        kind: 14,
        pubkey: user.pubkey,
        content: message.trim(),
        tags: [
          ['p', sellerPubkey],
          ['a', listingCoordinate],
        ],
        created_at: now,
      };
      const rumor = { ...rumorTemplate, id: getEventHash(rumorTemplate) };

      // 2. Seal (kind 13) — signed by the buyer, NIP-44 encrypted for the seller.
      const sealContent = await user.signer.nip44.encrypt(sellerPubkey, JSON.stringify(rumor));
      const seal = await user.signer.signEvent({
        kind: 13,
        content: sealContent,
        tags: [], // NIP-59: seals carry no tags
        created_at: now,
      });

      // 3. Gift wrap (kind 1059) — signed by a one-time ephemeral key, so the
      //    wrap itself reveals nothing about the sender.
      const ephemeralKey = generateSecretKey();
      const wrap = finalizeEvent(
        {
          kind: 1059,
          content: nip44.encrypt(
            JSON.stringify(seal),
            nip44.getConversationKey(ephemeralKey, sellerPubkey),
          ),
          tags: [['p', sellerPubkey]],
          created_at: now,
        },
        ephemeralKey,
      );

      // 4. Deliver — app pool plus the seller's NIP-65 read relays (best effort).
      await nostr.event(wrap, { signal: AbortSignal.timeout(5000) });

      try {
        const [relayEvent] = await nostr.query(
          [{ kinds: [10002], authors: [sellerPubkey], limit: 1 }],
          { signal: AbortSignal.timeout(2000) },
        );

        // Relays where the seller reads: no marker or "read" (NIP-65).
        const sellerRelays = (relayEvent?.tags ?? [])
          .filter(([name, , marker]) => name === 'r' && (marker === undefined || marker === 'read'))
          .map(([, url]) => url ?? '')
          .filter((url) => {
            try {
              return new URL(url).protocol === 'wss:';
            } catch {
              return false;
            }
          })
          .slice(0, 4);

        if (sellerRelays.length > 0) {
          await nostr.group(sellerRelays).event(wrap, { signal: AbortSignal.timeout(5000) });
        }
      } catch (error) {
        console.warn('Best-effort delivery to seller relays failed:', error);
      }

      setSent(true);
      toast({
        title: 'Poruka je poslata!',
        description: 'Prodavac će ti odgovoriti direktno u tvom Nostr klijentu (chat).',
      });
    } catch (error) {
      console.error('Failed to send direct message:', error);
      toast({
        title: 'Greška pri slanju poruke',
        description: 'Proveri konekciju i pokušaj ponovo.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {!user ? (
          <>
            <DialogHeader>
              <DialogTitle>Pošalji poruku prodavcu</DialogTitle>
              <DialogDescription>
                Poruke šifrovane end-to-end — potrebno je samo da se prijaviš na
                svoj Nostr nalog.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4">
              <LoginArea className="flex" />
            </div>
          </>
        ) : sent ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" aria-hidden />
                Poruka je poslata
              </DialogTitle>
              <DialogDescription>
                Šifrovana poruka je dostavljena prodavcu. Odgovor će ti stići u
                chat tvog Nostr klijenta (Damus, Amethyst, Snort i sl.).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Zatvori</Button>
            </DialogFooter>
          </>
        ) : !signerSupportsNip44 ? (
          <>
            <DialogHeader>
              <DialogTitle>Signer ne podržava šifrovane poruke</DialogTitle>
              <DialogDescription>
                Tvoj način prijave ne podržava NIP-44 enkripciju. Nadogradi
                ekstenziju ili koristi drugi način prijave, pa probaj ponovo.
              </DialogDescription>
            </DialogHeader>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Pošalji poruku prodavcu</DialogTitle>
              <DialogDescription>
                Poruka je end-to-end šifrovana (NIP-44) i dostavljena kao
                poklon-paket (NIP-59) — niko osim prodavca ne može da je pročita.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="seller-message" className="text-sm font-medium">
                Poruka
              </label>
              <Textarea
                id="seller-message"
                rows={5}
                maxLength={MAX_MESSAGE_LENGTH}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />
              <p className="text-right text-xs text-muted-foreground">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Otkaži
              </Button>
              <Button className="gap-1.5" onClick={() => void handleSend()} disabled={!canSend}>
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Šaljem…
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden />
                    Pošalji poruku
                  </>
                )}
              </Button>
            </DialogFooter>

            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden />
              Privatno — sadržaj je vidljiv samo tebi i prodavcu.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
