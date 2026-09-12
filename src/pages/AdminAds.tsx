import { useMemo, useState, type FormEvent } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { SponsoredCard } from '@/components/sponsored/SponsoredCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useListings, useListing } from '@/hooks/useListings';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useSponsoredCampaigns, useSponsoredSliderSettings } from '@/hooks/useSponsoredCampaigns';
import { ADMIN_PUBKEYS, isAdminPubkey } from '@/lib/admin';
import {
  CAMPAIGN_CURRENCIES,
  DEFAULT_SLIDER_SETTINGS,
  DESKTOP_ADS_MAX,
  DESKTOP_ADS_MIN,
  DURATION_MAX,
  DURATION_MIN,
  SECONDS_PER_SLIDE_MAX,
  SECONDS_PER_SLIDE_MIN,
  campaignTags,
  getCampaignLifecycleStatus,
  type AdCampaign,
  type CampaignAccent,
  type CampaignBadge,
  type CampaignCurrency,
  type CampaignType,
} from '@/lib/sponsored/core';
import { SPONSORED_CAMPAIGN_KIND, SPONSORED_SETTINGS_D, SPONSORED_SETTINGS_KIND } from '@/lib/sponsored/kinds';
import { LISTING_KIND } from '@/lib/listings';

import { AlertCircle, CheckCircle2, Loader2, Megaphone, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react';

interface FormState {
  type: CampaignType;
  listingCoordinate: string;
  title: string;
  description: string;
  image: string;
  url: string;
  cta: string;
  price: string;
  currency: CampaignCurrency;
  duration: string;
  startAt: string;
  endAt: string;
  enabled: boolean;
  priority: string;
  accent: CampaignAccent;
  badge: CampaignBadge;
}

function dateInput(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyForm(): FormState {
  const now = Math.floor(Date.now() / 1000);
  return {
    type: 'sponsored-listing', listingCoordinate: '', title: '', description: '', image: '', url: '', cta: 'Saznaj više',
    price: '1000', currency: 'sats', duration: '7', startAt: dateInput(now), endAt: dateInput(now + 7 * 86400),
    enabled: false, priority: '0', accent: 'primary', badge: 'featured',
  };
}

function toTimestamp(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

function statusLabel(status: ReturnType<typeof getCampaignLifecycleStatus>): string {
  return { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', expired: 'Expired', disabled: 'Disabled' }[status];
}

function StatusBadge({ campaign }: { campaign: AdCampaign }) {
  const status = getCampaignLifecycleStatus(campaign);
  return <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{statusLabel(status)}</span>;
}

function ListingPreview({ campaign }: { campaign: AdCampaign }) {
  const coordinate = campaign.listingCoordinate?.split(':') ?? [];
  const { data: listing } = useListing(coordinate[1] ?? '', coordinate.slice(2).join(':'));
  return <SponsoredCard campaign={campaign} listing={listing ?? undefined} />;
}

export default function AdminAds() {
  useSeoMeta({ title: 'Admin reklame — Oglasnik', description: 'Upravljanje sponzorisanim kampanjama.' });
  const { user } = useCurrentUser();
  const { data: campaigns = [], isPending } = useSponsoredCampaigns();
  const { settings } = useSponsoredSliderSettings();
  const { data: listings = [] } = useListings(undefined);
  const { mutateAsync: publish, isPending: publishing } = useNostrPublish();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<AdCampaign | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsForm, setSettingsForm] = useState(settings);

  const authorized = Boolean(user && isAdminPubkey(user.pubkey) && ADMIN_PUBKEYS.length > 0);
  const previewCampaign = useMemo(() => {
    if (!authorized || !form.title && form.type === 'promo' || !form.listingCoordinate && form.type === 'sponsored-listing') return null;
    const now = Math.floor(Date.now() / 1000);
    const tags = campaignTags({
      d: editing?.d ?? 'preview', type: form.type, priceAmount: Number(form.price), currency: form.currency,
      durationDays: Number(form.duration), startAt: toTimestamp(form.startAt), endAt: toTimestamp(form.endAt),
      enabled: form.enabled, priority: Number(form.priority), accent: form.accent, badge: form.badge,
      listingCoordinate: form.listingCoordinate,
      promo: form.type === 'promo' ? { title: form.title, description: form.description || undefined, image: form.image, url: form.url, ctaLabel: form.cta } : undefined,
    });
    return {
      event: {} as AdCampaign['event'], author: user?.pubkey ?? '', d: editing?.d ?? 'preview', type: form.type,
      listingCoordinate: form.type === 'sponsored-listing' ? form.listingCoordinate : undefined,
      promo: form.type === 'promo' ? { title: form.title, description: form.description || undefined, image: form.image, url: form.url, ctaLabel: form.cta } : undefined,
      price: { amount: Number(form.price), currency: form.currency }, durationDays: Number(form.duration),
      startAt: toTimestamp(form.startAt), endAt: toTimestamp(form.endAt), status: form.enabled ? 'active' as const : 'disabled' as const,
      priority: Number(form.priority), accent: form.accent, badge: form.badge, createdAt: now,
      coordinate: `${SPONSORED_CAMPAIGN_KIND}:${user?.pubkey ?? ''}:${editing?.d ?? 'preview'}`,
      __tags: tags,
    } as AdCampaign & { __tags: string[][] };
  }, [authorized, editing, form, user]);

  if (!authorized) {
    return <div className="container max-w-xl py-16"><Card><CardContent className="space-y-4 py-12 text-center"><ShieldAlert className="mx-auto size-10 text-muted-foreground" /><h1 className="text-2xl font-bold">Nedostupan admin panel</h1><p className="text-muted-foreground">Ova stranica je dostupna samo konfigurisanom admin nalogu.</p></CardContent></Card></div>;
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const validate = (): string | null => {
    const price = Number(form.price); const duration = Number(form.duration); const priority = Number(form.priority);
    const start = toTimestamp(form.startAt); const end = toTimestamp(form.endAt);
    if (!form.price || !Number.isFinite(price) || price <= 0) return 'Cena mora biti pozitivan broj.';
    if (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX) return `Trajanje mora biti između ${DURATION_MIN} i ${DURATION_MAX} dana.`;
    if (!Number.isInteger(priority) || priority < -1000 || priority > 1000) return 'Prioritet mora biti između -1000 i 1000.';
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'End mora biti posle start vremena.';
    if (form.type === 'sponsored-listing' && !form.listingCoordinate.startsWith(`${LISTING_KIND}:`)) return 'Izaberi postojeći listing.';
    if (form.type === 'promo') {
      if (!form.title || form.title.length > 80) return 'Promo naslov je obavezan i ima najviše 80 karaktera.';
      if (!form.image.startsWith('https://') || !form.url.startsWith('https://')) return 'Slika i destinacija moraju biti HTTPS URL-ovi.';
      if (!form.cta || form.cta.length > 24) return 'CTA je obavezan i ima najviše 24 karaktera.';
      if (form.description.length > 200) return 'Opis ima najviše 200 karaktera.';
    }
    return null;
  };

  const startCreate = () => { setEditing(null); setError(''); setSuccess(''); setForm(emptyForm()); };

  const editCampaign = (campaign: AdCampaign) => {
    setEditing(campaign); setError(''); setSuccess('');
    setForm({
      type: campaign.type, listingCoordinate: campaign.listingCoordinate ?? '', title: campaign.promo?.title ?? '', description: campaign.promo?.description ?? '',
      image: campaign.promo?.image ?? '', url: campaign.promo?.url ?? '', cta: campaign.promo?.ctaLabel ?? 'Saznaj više', price: String(campaign.price.amount), currency: campaign.price.currency,
      duration: String(campaign.durationDays), startAt: dateInput(campaign.startAt), endAt: dateInput(campaign.endAt), enabled: campaign.status === 'active', priority: String(campaign.priority), accent: campaign.accent, badge: campaign.badge,
    });
  };

  const saveCampaign = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setSuccess('');
    const validationError = validate(); if (validationError) { setError(validationError); return; }
    if (!user) return;
    const d = editing?.d ?? `campaign-${Date.now().toString(36)}`;
    const tags = campaignTags({ d, type: form.type, priceAmount: Number(form.price), currency: form.currency, durationDays: Number(form.duration), startAt: toTimestamp(form.startAt), endAt: toTimestamp(form.endAt), enabled: form.enabled, priority: Number(form.priority), accent: form.accent, badge: form.badge, listingCoordinate: form.listingCoordinate, promo: form.type === 'promo' ? { title: form.title.trim(), description: form.description.trim() || undefined, image: form.image.trim(), url: form.url.trim(), ctaLabel: form.cta.trim() } : undefined });
    try {
      await publish({ kind: SPONSORED_CAMPAIGN_KIND, content: '', tags });
      await queryClient.invalidateQueries({ queryKey: ['sponsored'] });
      setSuccess(editing ? 'Kampanja je ažurirana.' : 'Kampanja je objavljena.'); setEditing(null); setForm(emptyForm());
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : 'Objavljivanje nije uspelo.'); }
  };

  const disableCampaign = async (campaign: AdCampaign) => {
    try {
      const tags = campaign.event.tags.map((tag) => tag[0] === 'status' ? ['status', 'disabled'] : tag);
      if (!tags.some(([name]) => name === 'status')) tags.push(['status', 'disabled']);
      await publish({ kind: SPONSORED_CAMPAIGN_KIND, content: campaign.event.content, tags });
      await queryClient.invalidateQueries({ queryKey: ['sponsored'] }); setSuccess('Kampanja je onemogućena.');
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : 'Izmena nije uspela.'); }
  };

  const saveSettings = async () => {
    try {
      await publish({ kind: SPONSORED_SETTINGS_KIND, content: '', tags: [['d', SPONSORED_SETTINGS_D], ['desktopAds', String(Math.min(3, Math.max(1, settingsForm.desktopAds)))], ['secondsPerSlide', String(Math.min(30, Math.max(3, settingsForm.secondsPerSlide)))], ['autoRotate', String(settingsForm.autoRotate)], ['pauseOnInteraction', String(settingsForm.pauseOnInteraction)], ['alt', 'Podešavanja sponzorisanog slajdera']] });
      await queryClient.invalidateQueries({ queryKey: ['sponsored', 'settings'] }); setSuccess('Slider podešavanja su sačuvana.');
    } catch (publishError) { setError(publishError instanceof Error ? publishError.message : 'Podešavanja nisu sačuvana.'); }
  };

  return (
    <div className="container max-w-6xl space-y-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Admin — reklame</h1><p className="mt-1 text-muted-foreground">Upravljanje kampanjama i slider podešavanjima. Cena ovde nije potvrda plaćanja.</p></div><Button onClick={startCreate}><Plus className="size-4" /> Nova kampanja</Button></div>
      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="size-4" />{error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300"><CheckCircle2 className="size-4" />{success}</div>}

      <Card><CardHeader><CardTitle>Slider podešavanja</CardTitle><CardDescription>Bez payment logike — samo način prikaza.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-2"><Label>Desktop oglasa (1–3)</Label><Input type="number" min={1} max={3} value={settingsForm.desktopAds} onChange={(e) => setSettingsForm({ ...settingsForm, desktopAds: Number(e.target.value) })} /></div><div className="space-y-2"><Label>Sekundi po slajdu (3–30)</Label><Input type="number" min={3} max={30} value={settingsForm.secondsPerSlide} onChange={(e) => setSettingsForm({ ...settingsForm, secondsPerSlide: Number(e.target.value) })} /></div><label className="flex items-center gap-3 pt-6 text-sm"><Switch checked={settingsForm.autoRotate} onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, autoRotate: checked })} /> Auto rotacija</label><label className="flex items-center gap-3 pt-6 text-sm"><Switch checked={settingsForm.pauseOnInteraction} onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, pauseOnInteraction: checked })} /> Pauza na interakciju</label><Button className="sm:col-span-2 lg:col-span-4" onClick={() => void saveSettings()} disabled={publishing}>Sačuvaj slider podešavanja</Button></CardContent></Card>

      {(editing || form.type) && <Card><CardHeader><CardTitle>{editing ? 'Uredi kampanju' : 'Nova kampanja'}</CardTitle><CardDescription>Validacija i enum ograničenja dolaze iz SP1 modela.</CardDescription></CardHeader><CardContent><form onSubmit={(e) => void saveCampaign(e)} className="grid gap-4 lg:grid-cols-2" noValidate>
        <div className="space-y-2"><Label>Tip</Label><Select value={form.type} onValueChange={(v) => set('type', v as CampaignType)} disabled={Boolean(editing)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sponsored-listing">Sponsored listing</SelectItem><SelectItem value="promo">Promo / referral</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Cena</Label><div className="flex gap-2"><Input className="flex-1" value={form.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" /><Select value={form.currency} onValueChange={(v) => set('currency', v as CampaignCurrency)}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{CAMPAIGN_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></div>
        {form.type === 'sponsored-listing' ? <div className="space-y-2 lg:col-span-2"><Label>Postojeći oglas</Label><Select value={form.listingCoordinate} onValueChange={(v) => set('listingCoordinate', v)}><SelectTrigger><SelectValue placeholder="Izaberi oglas" /></SelectTrigger><SelectContent>{listings.map((listing) => <SelectItem key={listing.event.id} value={`${LISTING_KIND}:${listing.pubkey}:${listing.d}`}>{listing.title}</SelectItem>)}</SelectContent></Select></div> : <><div className="space-y-2"><Label>Promo naslov (max 80)</Label><Input value={form.title} maxLength={80} onChange={(e) => set('title', e.target.value)} /></div><div className="space-y-2"><Label>CTA (max 24)</Label><Input value={form.cta} maxLength={24} onChange={(e) => set('cta', e.target.value)} /></div><div className="space-y-2"><Label>HTTPS slika</Label><Input value={form.image} onChange={(e) => set('image', e.target.value)} placeholder="https://…" /></div><div className="space-y-2"><Label>HTTPS destinacija</Label><Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" /></div><div className="space-y-2 lg:col-span-2"><Label>Opis (max 200)</Label><Textarea value={form.description} maxLength={200} onChange={(e) => set('description', e.target.value)} /></div></>}
        <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} /></div><div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} /></div><div className="space-y-2"><Label>Trajanje (1–365 dana)</Label><Input type="number" min={1} max={365} value={form.duration} onChange={(e) => set('duration', e.target.value)} /></div><div className="space-y-2"><Label>Prioritet (-1000…1000)</Label><Input type="number" min={-1000} max={1000} value={form.priority} onChange={(e) => set('priority', e.target.value)} /></div><div className="space-y-2"><Label>Akcenat</Label><Select value={form.accent} onValueChange={(v) => set('accent', v as CampaignAccent)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="amber">Amber</SelectItem><SelectItem value="green">Green</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Badge</Label><Select value={form.badge} onValueChange={(v) => set('badge', v as CampaignBadge)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="featured">Istaknuto</SelectItem><SelectItem value="promo">Promovisano</SelectItem><SelectItem value="new">Novo</SelectItem></SelectContent></Select></div><label className="flex items-center gap-3"><Switch checked={form.enabled} onCheckedChange={(checked) => set('enabled', checked)} /> Omogućeno</label><div className="flex gap-2 lg:col-span-2"><Button type="submit" disabled={publishing}>{publishing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Objavi kampanju</Button><Button type="button" variant="outline" onClick={startCreate}>Očisti formu</Button></div>
      </form></CardContent></Card>}

      {previewCampaign && <Card><CardHeader><CardTitle>Live preview</CardTitle><CardDescription>Ista SponsoredCard komponenta koja se koristi na marketplace-u.</CardDescription></CardHeader><CardContent className="max-w-2xl">{form.type === 'sponsored-listing' ? <ListingPreview campaign={previewCampaign} /> : <SponsoredCard campaign={previewCampaign} />}</CardContent></Card>}

      <Card><CardHeader><CardTitle>Kampanje</CardTitle></CardHeader><CardContent>{isPending ? <p className="text-muted-foreground">Učitavanje…</p> : campaigns.length === 0 ? <p className="text-muted-foreground">Nema kampanja.</p> : <div className="grid gap-3">{campaigns.map((campaign) => <div key={campaign.event.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{campaign.type === 'promo' ? campaign.promo?.title : campaign.listingCoordinate}</p><p className="text-xs text-muted-foreground">{campaign.price.amount} {campaign.price.currency} · priority {campaign.priority} · {new Date(campaign.startAt * 1000).toLocaleDateString('sr-RS')}–{new Date(campaign.endAt * 1000).toLocaleDateString('sr-RS')}</p></div><StatusBadge campaign={campaign} /><Button size="sm" variant="outline" onClick={() => editCampaign(campaign)}>Uredi</Button>{campaign.status === 'active' && <Button size="sm" variant="destructive" onClick={() => void disableCampaign(campaign)} disabled={publishing}><Trash2 className="size-3" /> Onemogući</Button>}</div>)}</div>}</CardContent></Card>
    </div>
  );
}
