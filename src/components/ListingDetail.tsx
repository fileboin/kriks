import { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useQueryClient } from '@tanstack/react-query';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MessageSellerDialog } from '@/components/MessageSellerDialog';
import { EscrowCreateDialog, type EscrowPreset } from '@/components/escrow/EscrowCreateDialog';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useListing } from '@/hooks/useListings';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import {
  CATEGORY_LABELS,
  CONDITIONS,
  LISTING_KIND,
  formatPrice,
  sanitizeUrl,
  timeAgo,
  type Listing,
} from '@/lib/listings';
import { cn } from '@/lib/utils';

import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Copy,
  ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  PackageX,
  ShieldCheck,
  Tag,
  UserRound,
} from 'lucide-react';

export interface ListingDetailProps {
  pubkey: string;
  identifier: string;
}

function Paragraphs({ content }: { content: string }) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 text-pretty">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-wrap leading-relaxed">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function SellerCard({ listing }: { listing: Listing }) {
  const pubkey = listing.pubkey;
  const author = useAuthor(pubkey);
  const { toast } = useToast();
  const [messageOpen, setMessageOpen] = useState(false);
  const [escrowOpen, setEscrowOpen] = useState(false);

  const metadata = author.data?.metadata;
  const displayName = metadata?.display_name ?? metadata?.name ?? 'Anonimni prodavac';
  const picture = metadata?.picture ? sanitizeUrl(metadata.picture) : undefined;
  const npub = nip19.npubEncode(pubkey);
  const shortNpubPubkey = `${npub.slice(0, 10)}…${npub.slice(-4)}`;

  const copyPubkey = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      toast({
        title: 'Nostr adresa kopirana',
        description: 'Kontaktiraj prodavca iz svog Nostr klijenta (npr. Amethyst, Damus, Snort).',
      });
    } catch {
      toast({
        title: 'Ne mogu da kopiram adresu',
        description: 'Kopiraj je ručno sa profila prodavca.',
        variant: 'destructive',
      });
    }
  };

  const escrowPreset: EscrowPreset = {
    adapterId: 'goods',
    terms: {
      title: listing.title,
      price: listing.price ? String(listing.price.amount) : '',
      currency: listing.price?.currency ?? 'RSD',
    },
    counterpartyPubkey: pubkey,
    counterpartyLabel: 'Prodavac iz ovog oglasa',
    myRole: 'buyer',
    listingCoordinate: `${LISTING_KIND}:${listing.pubkey}:${listing.d}`,
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {picture && <AvatarImage src={picture} alt={displayName} />}
            <AvatarFallback>
              <UserRound className="size-5" aria-hidden />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground" title={npub}>
              {shortNpubPubkey}
            </p>
          </div>
          {metadata?.nip05 && (
            <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Verifikovan NIP-05" />
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <Button className="gap-1.5" onClick={() => setMessageOpen(true)}>
            <MessageCircle className="size-4" aria-hidden />
            Pošalji poruku
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link to={`/${npub}`} aria-label="Profil prodavca">
              <UserRound className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void copyPubkey()}
            aria-label="Kopiraj Nostr adresu"
          >
            <Copy className="size-4" aria-hidden />
          </Button>
        </div>

        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => setEscrowOpen(true)}
        >
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          Kupi uz escrow
        </Button>

        <p className="text-xs text-muted-foreground">
          Poruka je end-to-end šifrovana — direktno preko Nostr-a, bez posrednika.
          Odgovor će ti stići u chat tvog Nostr klijenta.
        </p>
      </CardContent>

      <MessageSellerDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        sellerPubkey={pubkey}
        listingTitle={listing.title}
        listingCoordinate={`${LISTING_KIND}:${listing.pubkey}:${listing.d}`}
      />

      <EscrowCreateDialog open={escrowOpen} onOpenChange={setEscrowOpen} preset={escrowPreset} />
    </Card>
  );
}

function OwnerActions({ listing }: { listing: Listing }) {
  const { mutateAsync: createEvent, isPending } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setStatus = async (status: 'active' | 'sold') => {
    const tags = listing.event.tags.map((tag) =>
      tag[0] === 'status' ? ['status', status] : tag,
    );
    if (!tags.some(([name]) => name === 'status')) tags.push(['status', status]);

    try {
      await createEvent({ kind: LISTING_KIND, content: listing.event.content, tags });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast({
        title: status === 'sold' ? 'Oglas označen kao prodat' : 'Oglas je ponovo aktivan',
      });
    } catch (error) {
      console.error('Status update failed:', error);
      toast({ title: 'Greška pri ažuriranju oglasa', variant: 'destructive' });
    }
  };

  const deleteListing = async () => {
    try {
      await createEvent({
        kind: 5,
        content: '',
        tags: [
          ['e', listing.event.id],
          // NIP-09 addressable coordinate: kind:pubkey:d
          ['a', `${LISTING_KIND}:${listing.pubkey}:${listing.d}`],
        ],
      });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast({ title: 'Oglas je obrisan' });
      setConfirmDelete(false);
    } catch (error) {
      console.error('Delete failed:', error);
      toast({ title: 'Greška pri brisanju oglasa', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tvoj oglas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {listing.status === 'active' ? (
          <Button variant="outline" className="gap-1.5" disabled={isPending} onClick={() => void setStatus('sold')}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
            Označi kao prodat
          </Button>
        ) : (
          <Button variant="outline" className="gap-1.5" disabled={isPending} onClick={() => void setStatus('active')}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Tag className="size-4" aria-hidden />}
            Oglasi kao aktivan
          </Button>
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="gap-1.5" disabled={isPending}>
              <PackageX className="size-4" aria-hidden />
              Obriši oglas
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Obrisati oglas?</AlertDialogTitle>
              <AlertDialogDescription>
                Oglas će biti trajno uklonjen sa relay servera koji poštuju NIP-09 brisanje.
                Ova akcija se ne može poništiti.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void deleteListing();
                }}
              >
                Obriši
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function ListingDetail({ pubkey, identifier }: ListingDetailProps) {
  const { data: listing, isPending, isError } = useListing(pubkey, identifier);
  const { user } = useCurrentUser();
  const [activeImage, setActiveImage] = useState(0);

  if (isPending) {
    return (
      <div className="container max-w-6xl space-y-6 py-8">
        <Skeleton className="h-5 w-28" />
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="container max-w-2xl py-16">
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <PackageX className="mx-auto size-10 text-muted-foreground/60" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold">Oglas nije pronađen</h1>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Oglas je možda obrisan ili relay serveri još nisu odgovorili. Pokušaj ponovo
              za koji trenutak.
            </p>
            <Button className="mt-6 rounded-full" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" aria-hidden />
                Svi oglasi
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const category = listing.categories[0];
  const isSold = listing.status === 'sold';
  const isOwner = user?.pubkey === listing.pubkey;
  const image = listing.images[activeImage];

  return (
    <div className="container max-w-6xl py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 rounded"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Svi oglasi
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Gallery + description */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-xl border bg-muted">
            <div className="relative aspect-[4/3]">
              {image ? (
                <img src={image} alt={listing.title} className="size-full object-contain" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/50">
                  <ImageIcon className="size-16" aria-hidden />
                </div>
              )}
              {isSold && (
                <Badge variant="destructive" className="absolute top-3 left-3 rounded-full uppercase tracking-wide">
                  Prodato
                </Badge>
              )}
            </div>
          </div>

          {listing.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label="Slike oglasa">
              {listing.images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  role="option"
                  aria-selected={i === activeImage}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    i === activeImage ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <img src={url} alt={`Slika ${i + 1}`} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Opis</CardTitle>
            </CardHeader>
            <CardContent>
              {listing.summary && (
                <>
                  <p className="text-muted-foreground italic">{listing.summary}</p>
                  <Separator className="my-4" />
                </>
              )}
              <Paragraphs content={listing.event.content} />
            </CardContent>
          </Card>
        </div>

        {/* Info panel */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h1 className="text-2xl font-bold tracking-tight text-balance">{listing.title}</h1>

              <p className="text-3xl font-extrabold tracking-tight">{formatPrice(listing.price)}</p>

              <div className="flex flex-wrap gap-2">
                {category && (
                  <Badge variant="secondary" className="rounded-full">
                    {CATEGORY_LABELS.get(category) ?? category}
                  </Badge>
                )}
                {listing.condition && (
                  <Badge variant="outline" className="rounded-full">
                    {CONDITIONS.find((c) => c.value === listing.condition)?.label ?? listing.condition}
                  </Badge>
                )}
                {isSold && (
                  <Badge variant="destructive" className="rounded-full uppercase">Prodato</Badge>
                )}
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                {listing.location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    {listing.location}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <CalendarDays className="size-4 shrink-0" aria-hidden />
                  Objavljeno {timeAgo(listing.publishedAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          {isOwner ? (
            <OwnerActions listing={listing} />
          ) : (
            <SellerCard listing={listing} />
          )}
        </div>
      </div>
    </div>
  );
}
