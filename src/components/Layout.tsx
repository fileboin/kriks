import { Link, NavLink, Outlet } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { Menu, Plus, Tag, Wallet } from 'lucide-react';

const NAV_LINKS = [
  { to: '/', label: 'Svi oglasi' },
  { to: '/escrow', label: 'Escrow' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/moji-oglas', label: 'Moj oglas' },
  { to: '/novi-oglas', label: 'Novi oglas' },
];

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Otvori meni"
        >
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-primary-foreground">
              <Tag className="size-4" aria-hidden />
            </span>
            Oglasnik
          </SheetTitle>
          <SheetDescription className="sr-only">Glavna navigacija</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Mobilna navigacija">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-2 sm:gap-3">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="Oglasnik — početna"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-primary-foreground shadow-sm">
            <Tag className="size-5" aria-hidden />
          </span>
          <span className="hidden text-xl font-bold tracking-tight sm:inline">
            Oglas<span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">nik</span>
          </span>
        </Link>

        <nav className="ml-1 hidden items-center gap-1 md:flex" aria-label="Glavna navigacija">
          <Button variant="ghost" className="rounded-full" asChild>
            <Link to="/">Oglasi</Link>
          </Button>
          <Button variant="ghost" className="rounded-full" asChild>
            <Link to="/escrow">Escrow</Link>
          </Button>
          <Button variant="ghost" className="rounded-full" asChild>
            <Link to="/moji-oglas">Moj oglas</Link>
          </Button>
        </nav>

        <div className={cn('ml-auto flex items-center gap-2 sm:gap-3')}>
          {/* Wallet entry (Bro: AppBar actions, top-right, orange) */}
          <Button variant="outline" size="icon" className="rounded-full" asChild>
            <Link to="/wallet" aria-label="Wallet">
              <Wallet className="size-5 text-primary" aria-hidden />
            </Link>
          </Button>
          <Button className="rounded-full" asChild>
            <Link to="/novi-oglas" className="gap-1.5" aria-label="Novi oglas">
              <Plus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Novi oglas</span>
            </Link>
          </Button>
          <LoginArea className="max-w-44 sm:max-w-52" />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>
          Oglasnik — oglasna tabla na{' '}
          <a
            href="https://nostr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Nostr protokolu
          </a>
          . Bez servera, bez provizija.
        </p>
        <p>
          Vibed with{' '}
          <a
            href="https://shakespeare.diy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Shakespeare
          </a>
        </p>
      </div>
    </footer>
  );
}

export function Layout({ className }: { className?: string }) {
  return (
    <div className={cn('flex min-h-screen flex-col', className)}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
