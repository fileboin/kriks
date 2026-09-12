/**
 * Admin trust model (SP1 — sponsored campaigns).
 *
 * Sponsored/featured campaigns and slider settings are only rendered from
 * events signed by one of these pubkeys. This is the initial trust model:
 * paid placement is operator-controlled by definition, while reading stays
 * open to anyone on the relays.
 *
 * Empty by default — nothing renders until the operator's pubkey is added,
 * which is the fail-safe state.
 *
 * NOTE: hex pubkeys only (64 chars). Add the operator's real key when the
 * first campaign is ready to go live.
 */
export const ADMIN_PUBKEYS: readonly string[] = [
  // DEMO admin (Demo Prodavac identity) — replace with the real operator
  // key before production (SP3 admin UI).
  '8b5658124f5b703ccec1aa84c0253b5abe6c0000f24b4b1491742e572a2059fe',
];

export function hasAdminPubkeys(): boolean {
  return ADMIN_PUBKEYS.length > 0;
}

export function isAdminPubkey(pubkey: string, admins: readonly string[] = ADMIN_PUBKEYS): boolean {
  return admins.includes(pubkey);
}
