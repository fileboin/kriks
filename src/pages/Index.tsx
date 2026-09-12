import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';

import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useListings } from '@/hooks/useListings';
import { CATEGORIES, listingMatchesSearch } from '@/lib/listings';
import { cn } from '@/lib/utils';

import { ArrowRight, PackageSearch, Plus, Search } from 'lucide-react';

const Index = () => {
  useSeoMeta({
    title: 'Oglasnik — kupuj i prodaj na Nostr-u',
    description: 'Decentralizovana oglasna tabla na Nostr protokolu. Bez servera, bez provizija.',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('k') ?? undefined;
  const query = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(query);

  const { data: listings, isPending, isError } = useListings(category);

  const filtered = useMemo(() => {
    if (!listings) return [];
    return listings.filter((listing) => listingMatchesSearch(listing, query));
  }, [listings, query]);

  const setCategory = (value: string | undefined) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('k', value);
      else next.delete('k');
      return next;
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (searchInput.trim()) next.set('q', searchInput.trim());
      else next.delete('q');
      return next;
    });
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-indigo-50 via-background to-background dark:from-indigo-950/30 dark:via-background dark:to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45rem_20rem_at_75%_-10%,rgba(103,232,249,0.35),transparent)] dark:bg-[radial-gradient(45rem_20rem_at_75%_-10%,rgba(8,145,178,0.18),transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(35rem_20rem_at_10%_0%,rgba(199,210,254,0.5),transparent)] dark:bg-[radial-gradient(35rem_20rem_at_10%_0%,rgba(67,56,202,0.22),transparent)]"
        />
        <div className="relative container flex flex-col items-center py-16 text-center md:py-24">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Kupuj i prodaj.{' '}
            <span className="bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">
              Bez posrednika.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-balance">
            Oglasna tabla na Nostr protokolu — decentralizovana, bez servera i bez
            provizija. Oglasi se objavljuju direktno sa tvog Nostr naloga.
          </p>

          <form
            onSubmit={submitSearch}
            className="mt-8 flex w-full max-w-lg items-center gap-2 rounded-full border bg-background p-1.5 pl-4 shadow-sm"
            role="search"
          >
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <label htmlFor="hero-search" className="sr-only">
              Pretraži oglase
            </label>
            <Input
              id="hero-search"
              type="search"
              placeholder="Šta tražiš? npr. iPhone, stan, bicikl…"
              className="h-10 flex-1 border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button type="submit" className="h-10 rounded-full px-6">
              Traži
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-full" asChild>
              <Link to="/novi-oglas" className="gap-2">
                <Plus className="size-5" aria-hidden />
                Objavi oglas — besplatno
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full" asChild>
              <a
                href="https://nostr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                Šta je Nostr?
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories + results */}
      <section className="container py-8 md:py-10" aria-label="Oglasi">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Kategorije">
          <button
            type="button"
            onClick={() => setCategory(undefined)}
            aria-pressed={!category}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              !category
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            Svi oglasi
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(category === c.value ? undefined : c.value)}
              aria-pressed={category === c.value}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                category === c.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            {query ? `Rezultati za „${query}“` : 'Najnoviji oglasi'}
          </h2>
          {filtered.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'oglas' : 'oglasa'}
            </p>
          )}
        </div>

        <div className="mt-4">
          {isPending ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <Card className="border-dashed">
              <CardContent className="px-8 py-12 text-center">
                <p className="mx-auto max-w-sm text-muted-foreground">
                  Greška pri učitavanju oglasa. Proveri internet konekciju ili pokušaj
                  ponovo za koji trenutak.
                </p>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="px-8 py-12 text-center">
                <PackageSearch className="mx-auto size-10 text-muted-foreground/60" aria-hidden />
                <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
                  {query || category
                    ? 'Nema oglasa koji odgovaraju pretrazi. Pokušaj sa drugom kategorijom ili rečju.'
                    : 'Još nema oglasa. Budi prvi — objavi svoj oglas!'}
                </p>
                <Button className="mt-5 rounded-full" asChild>
                  <Link to="/novi-oglas" className="gap-1.5">
                    <Plus className="size-4" aria-hidden />
                    Objavi oglas
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.event.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Index;
