/**
 * Escrow adapters — pluggable trade types.
 *
 * An adapter defines: the terms form (field descriptors drive a generic UI),
 * a one-line trade summary, and the human steps each party follows. Adding a
 * new trade type (e.g. "usdc za xmr", goods, lightning) = registering a new
 * adapter here — no UI changes required.
 */

export interface EscrowField {
  name: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'number';
  required: boolean;
}

export interface EscrowAdapter {
  id: string;
  label: string;
  description: string;
  fields: EscrowField[];
  /** One-line human summary of the trade, e.g. "Prodaja 100 USDC za 0,42 XMR". */
  summary(terms: Record<string, string>): string;
  /** Steps the buyer follows. */
  buyerSteps(terms: Record<string, string>): string[];
  /** Steps the seller follows. */
  sellerSteps(terms: Record<string, string>): string[];
}

const step = (text: string) => text;

/** Crypto-to-crypto swap, e.g. "prodajem USDC za XMR". */
export const cryptoSwapAdapter: EscrowAdapter = {
  id: 'crypto-swap',
  label: 'Kripto zamena',
  description: 'Razmena dva asseta između kupca i prodavca (npr. USDC za XMR), uz arbitra kao jemca.',
  fields: [
    { name: 'give_asset', label: 'Prodavac daje (asset)', placeholder: 'USDC', type: 'text', required: true },
    { name: 'give_amount', label: 'Količina', placeholder: '100', type: 'number', required: true },
    { name: 'want_asset', label: 'Kupac plaća (asset)', placeholder: 'XMR', type: 'text', required: true },
    { name: 'want_amount', label: 'Količina', placeholder: '0.42', type: 'number', required: true },
    { name: 'note', label: 'Napomena (mreža, uslovi…)', placeholder: 'USDC na Solani, XMR na privatnom wallet-u', type: 'text', required: false },
  ],
  summary: (t) =>
    `Zamena: ${t.give_amount ?? '?'} ${t.give_asset ?? '?'} ⇄ ${t.want_amount ?? '?'} ${t.want_asset ?? '?'}`,
  buyerSteps: (t) => [
    step(`Pošalji ${t.want_amount ?? '?'} ${t.want_asset ?? '?'} prodavcu na uputstvo koje dobiješ (ili preko arbitra, ako je tako dogovoreno).`),
    step('Označi akciju "Uplaćeno" i nalepi dokaz (txid / hash) u napomenu.'),
    step('Kad prodavac isporuči i ti potvrdiš "Pusti sredstva", escrow je završen.'),
  ],
  sellerSteps: (t) => [
    step(`Kad kupac označi uplatu ${t.want_amount ?? '?'} ${t.want_asset ?? '?'}, proveri da je stvarno primio sredstva.`),
    step(`Pošalji kupcu ${t.give_amount ?? '?'} ${t.give_asset ?? '?'} i označi "Isporučeno".`),
    step('Sačekaj da kupac pusti sredstva — ili arbitar rešava spor ako do njega dođe.'),
  ],
};

/** Purchase of a NIP-99 listing (goods) — spawned from a listing detail. */
export const goodsAdapter: EscrowAdapter = {
  id: 'goods',
  label: 'Kupovina artikla',
  description: 'Kupovina proizvoda ili usluge iz oglasa, uz arbitra kao jemca za isporuku.',
  fields: [
    { name: 'title', label: 'Artikal', placeholder: 'iPhone 13', type: 'text', required: true },
    { name: 'price', label: 'Cena', placeholder: '95000', type: 'number', required: true },
    { name: 'currency', label: 'Valuta', placeholder: 'RSD', type: 'text', required: true },
    { name: 'note', label: 'Napomena (način plaćanja, preuzimanje…)', placeholder: 'Plaćam preko Lightning-a', type: 'text', required: false },
  ],
  summary: (t) => `Kupovina: ${t.title ?? 'artikal'} — ${t.price ?? '?'} ${t.currency ?? ''}`.trim(),
  buyerSteps: (t) => [
    step(`Plati ${t.price ?? '?'} ${t.currency ?? ''} prodavcu po dogovorenom načinu (napomena: ${t.note ?? 'nije navedena'}).`),
    step('Označi akciju "Uplaćeno" i nalepi dokaz (invoice/receipt) u napomenu.'),
    step('Kad primiš artikal, potvrdi "Pusti sredstva" — ili otvori spor ako nešto ne valja.'),
  ],
  sellerSteps: (t) => [
    step('Kad kupac označi uplatu, proveri da je sredstvo stvarno primljeno.'),
    step(`Isporuči artikal (${t.title ?? '?'}) i označi "Isporučeno".`),
    step('Sačekaj potvrdu kupca — ili arbitar rešava spor.'),
  ],
};

/** Sale of BTC over Lightning. */
export const lightningAdapter: EscrowAdapter = {
  id: 'lightning-btc',
  label: 'BTC preko Lightning-a',
  description: 'Prodaja ili kupovina sats preko Lightning network-a, uz arbitra kao jemca.',
  fields: [
    { name: 'amount_sats', label: 'Iznos (sats)', placeholder: '50000', type: 'number', required: true },
    { name: 'fiat_price', label: 'Dogovorena fiat cena (opciono)', placeholder: '4500', type: 'number', required: false },
    { name: 'fiat_currency', label: 'Valuta (opciono)', placeholder: 'RSD', type: 'text', required: false },
    { name: 'note', label: 'Napomena', placeholder: 'Invoice ide preko arbitra', type: 'text', required: false },
  ],
  summary: (t) =>
    t.fiat_price
      ? `${t.amount_sats ?? '?'} sats za ${t.fiat_price ?? '?'} ${t.fiat_currency ?? ''}`.trim()
      : `${t.amount_sats ?? '?'} sats`,
  buyerSteps: (t) => [
    step(`Plati ${t.fiat_price ? `${t.fiat_price} ${t.fiat_currency ?? ''} prodavcu` : 'dogovorenu cenu'} i označi "Uplaćeno" uz dokaz.`),
    step('Pošalji svoju Lightning invoice prodavcu (u napomeni akcije "Uplaćeno").'),
    step('Kad primiš sats, potvrdi "Pusti sredstva".'),
  ],
  sellerSteps: (t) => [
    step('Proveri da je kupac označio uplatu i da je fiat stigao.'),
    step(`Isplati ${t.amount_sats ?? '?'} sats na kupčevu invoice i označi "Isporučeno".`),
    step('Sačekaj potvrdu kupca — ili arbitar rešava spor.'),
  ],
};

export const ESCROW_ADAPTERS: readonly EscrowAdapter[] = [
  cryptoSwapAdapter,
  goodsAdapter,
  lightningAdapter,
];

export function getEscrowAdapter(id: string | undefined): EscrowAdapter | undefined {
  return ESCROW_ADAPTERS.find((a) => a.id === id);
}
