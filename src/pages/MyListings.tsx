import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';

import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserListings } from '@/hooks/useListings';

import { Inbox, PackageSearch, Plus } from 'lucide-react';

const MyListings = () => {
  useSeoMeta({
    title: 'Moj oglas — Oglasnik',
    description: 'Upravljaj svojim oglasima na Nostr-u.',
  });

  const { user } = useCurrentUser();
  const { data: listings, isPending } = useUserListings(user?.pubkey);

  if (!user) {
    return (
      <div className="container flex items-center justify-center py-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Prijavi se da vidiš svoje oglase</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Oglasi su vezani za tvoj Nostr nalog.
            </p>
            <LoginArea className="flex" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 md:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Moj oglas</h1>
          <p className="mt-2 text-muted-foreground">
            Svi oglasi koje si objavio sa svog Nostr naloga.
          </p>
        </div>
        <Button className="rounded-full" asChild>
          <Link to="/novi-oglas" className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            Novi oglas
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-8 py-12 text-center">
            <PackageSearch className="mx-auto size-10 text-muted-foreground/60" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold">Još nemaš oglase</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Kada objaviš prvi oglas, pojaviće se ovde. Objavljivanje je potpuno besplatno.
            </p>
            <Button className="mt-5 rounded-full" asChild>
              <Link to="/novi-oglas" className="gap-1.5">
                <Plus className="size-4" aria-hidden />
                Objavi prvi oglas
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Inbox className="size-4" aria-hidden />
            {listings.length} {listings.length === 1 ? 'oglas' : 'oglasa'} — klikni na oglas da ga
            označiš kao prodat ili obrišeš.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.event.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MyListings;
