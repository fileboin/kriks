import { useSeoMeta } from '@unhead/react';
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

import { PackageSearch } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useSeoMeta({
    title: '404 — Oglasnik',
    description: 'Stranica ili oglas koji tražiš ne postoji. Vrati se na pregled oglasa.',
  });

  useEffect(() => {
    console.error(
      '404 Error: User attempted to access non-existent route:',
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <PackageSearch className="mx-auto size-12 text-muted-foreground/60" aria-hidden />
        <h1 className="mt-4 mb-2 text-4xl font-bold tracking-tight">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">
          Ups! Stranica ili oglas ne postoji.
        </p>
        <Button className="rounded-full" asChild>
          <Link to="/">Vrati se na oglase</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
