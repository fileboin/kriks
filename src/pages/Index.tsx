import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  useSeoMeta({
    title: 'Shakespeare Radi! 🎭',
    description: 'Test stranica — sve funkcioniše.',
  });

  const [clicks, setClicks] = useState(0);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-white to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-6">
      <Card className="w-full max-w-lg text-center shadow-xl border-none">
        <CardHeader>
          <div className="text-6xl mb-4 motion-safe:animate-bounce">🎭</div>
          <CardTitle className="text-4xl font-bold tracking-tight">
            Radi! Sve je operativno.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-muted-foreground">
            Ovo je živa demonstracija — ova stranica je upravo generisana
            da pokaže da sve funkcioniše.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={() => setClicks((c) => c + 1)}
            >
              Klikni me!
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {clicks === 0
                ? 'Još nijedan klik.'
                : `Kliknuo si ${clicks} ${clicks === 1 ? 'put' : 'puta'}. 🎉`}
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p>
              <strong>Spremno za akciju:</strong> React 19 · Tailwind 4 · Nostr
              integracija
            </p>
            <p className="mt-1">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
