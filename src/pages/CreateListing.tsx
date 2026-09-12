import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useUploadFile } from '@/hooks/useUploadFile';
import {
  CATEGORIES,
  CONDITIONS,
  CURRENCIES,
  FREQUENCIES,
  LISTING_KIND,
  MAX_IMAGES,
  formatPrice,
  generateDTag,
} from '@/lib/listings';

import { CheckCircle2, ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react';

interface UploadedImage {
  url: string;
  tags: string[][];
}

const CreateListing = () => {
  useSeoMeta({
    title: 'Novi oglas — Oglasnik',
    description: 'Objavi oglas na Nostr-u — besplatno i bez registracije.',
  });

  const { user } = useCurrentUser();
  const { mutateAsync: createEvent, isPending: isPublishing } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('ostalo');
  const [priceAmount, setPriceAmount] = useState('');
  const [currency, setCurrency] = useState<string>('RSD');
  const [frequency, setFrequency] = useState<string>('none');
  const [condition, setCondition] = useState<string>('none');
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);

  const priceNumber = priceAmount.trim() === '' ? undefined : Number(priceAmount.replace(',', '.'));
  const priceValid = priceNumber === undefined || (Number.isFinite(priceNumber) && priceNumber >= 0);

  const formValid =
    title.trim().length >= 3 &&
    priceValid &&
    !isPublishing &&
    !isUploading;

  const handleFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    const room = MAX_IMAGES - images.length;
    const selected = Array.from(files).slice(0, room);

    for (const file of selected) {
      try {
        const tags = await uploadFile(file);
        const url = tags[0]?.[1];
        if (!url) throw new Error('Upload nije vratio URL');
        setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, { url, tags }]));
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          title: 'Greška pri uploadu slike',
          description: 'Pokušaj ponovo sa drugom slikom.',
          variant: 'destructive',
        });
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img.url !== url));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !formValid) return;

    const d = generateDTag(title);
    const tags: string[][] = [
      ['d', d],
      ['title', title.trim()],
      ['published_at', String(Math.floor(Date.now() / 1000))],
      ['t', category],
      ['status', 'active'],
    ];

    if (summary.trim()) tags.push(['summary', summary.trim().slice(0, 200)]);
    if (location.trim()) tags.push(['location', location.trim()]);
    if (priceNumber !== undefined && Number.isFinite(priceNumber)) {
      const priceTag = ['price', String(priceNumber), currency];
      if (frequency !== 'none') priceTag.push(frequency);
      tags.push(priceTag);
    }
    if (condition !== 'none') tags.push(['condition', condition]);

    for (const img of images) {
      const dim = img.tags.find(([name]) => name === 'dim')?.[1];
      tags.push(dim ? ['image', img.url, dim] : ['image', img.url]);
      tags.push(['imeta', ...img.tags.map(([name, value]) => `${name} ${value}`)]);
    }

    tags.push([
      'alt',
      `Oglas: ${title.trim()}${location.trim() ? `, ${location.trim()}` : ''}${
        priceNumber !== undefined && Number.isFinite(priceNumber)
          ? `, ${formatPrice({ amount: priceNumber, currency })}`
          : ''
      }`,
    ]);

    try {
      await createEvent({ kind: LISTING_KIND, content: description.trim(), tags });
      await queryClient.invalidateQueries({ queryKey: ['listings'] });
      toast({
        title: 'Oglas je objavljen!',
        description: 'Vidljiv je svima na Nostr mreži.',
      });
      navigate(
        `/${nip19.naddrEncode({
          kind: LISTING_KIND,
          pubkey: user.pubkey,
          identifier: d,
        })}`,
      );
    } catch (error) {
      console.error('Publish failed:', error);
      toast({
        title: 'Greška pri objavljivanju',
        description: 'Proveri konekciju sa relay serverima i pokušaj ponovo.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return (
      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Prijavi se da objaviš oglas</CardTitle>
            <CardDescription>
              Oglasi se objavljuju sa tvog Nostr naloga — tvoj ključ, tvoj oglas.
              Nema registracije.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <LoginArea className="flex" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Novi oglas</h1>
        <p className="mt-2 text-muted-foreground">
          Popuni podatke i objavi oglas na Nostr mreži — potpuno besplatno.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Naslov *</Label>
              <Input
                id="title"
                placeholder="npr. iPhone 13, 128GB, odlično stanje"
                maxLength={100}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{title.length}/100 karaktera</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategorija *</Label>
              <Select value={category} onValueChange={setCategory} required>
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Izaberi kategoriju" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Cena (ostavi prazno za dogovor)</Label>
                <Input
                  id="price"
                  type="text"
                  inputMode="decimal"
                  placeholder="npr. 45000"
                  aria-invalid={!priceValid}
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(e.target.value)}
                />
                {!priceValid && (
                  <p className="text-xs text-destructive">Unesi validan broj veći ili jednak 0.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Valuta</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="frequency">Period naplate (opciono)</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger id="frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Jednokratno</SelectItem>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Stanje</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id="condition" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Neodređeno</SelectItem>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Lokacija</Label>
              <Input
                id="location"
                placeholder="npr. Beograd, Novi Sad…"
                maxLength={60}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Opis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="summary">Kratak opis (opciono)</Label>
              <Input
                id="summary"
                placeholder="Ukratko — šta se prodaje, u jednom redu"
                maxLength={200}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detaljan opis *</Label>
              <Textarea
                id="description"
                placeholder="Opiši stanje, opremu, razlog prodaje, način preuzimanja…"
                rows={7}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Razdvoji odeljke praznim redom — svaki odeljak biće poseban paragraf.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slike</CardTitle>
            <CardDescription>
              Do {MAX_IMAGES} slike. Prva slika se prikazuje na kartici oglasa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
              aria-hidden
              tabIndex={-1}
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img) => (
                <figure
                  key={img.url}
                  className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <img
                    src={img.url}
                    alt="Slika oglasa"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.url)}
                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Ukloni sliku"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </figure>
              ))}

              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="size-6 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Plus className="size-6" aria-hidden />
                      <span className="text-xs font-medium">Dodaj sliku</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="size-3.5" aria-hidden />
              Slike se uploaduju na Blossom server i postaju javno dostupne.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Oglas će biti objavljen kao Nostr događaj (NIP-99, kind {LISTING_KIND}) sa tvog naloga.
          </p>
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full sm:w-auto"
            disabled={!formValid}
          >
            {isPublishing ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Objavljujem…
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" aria-hidden />
                Objavi oglas
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateListing;
