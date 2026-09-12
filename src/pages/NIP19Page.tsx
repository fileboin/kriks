import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';

import { ListingDetail } from '@/components/ListingDetail';
import { LISTING_KIND } from '@/lib/listings';

import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
    case 'nprofile':
      // AI agent should implement profile view here
      return <div>Profile placeholder</div>;

    case 'note':
      // AI agent should implement note view here
      return <div>Note placeholder</div>;

    case 'nevent':
      // AI agent should implement event view here
      return <div>Event placeholder</div>;

    case 'naddr': {
      const { kind, pubkey, identifier: d } = decoded.data;

      // NIP-99 classified listing detail
      if (kind === LISTING_KIND) {
        return <ListingDetail pubkey={pubkey} identifier={d} />;
      }

      // AI agent should implement other addressable event views here
      return <div>Addressable event placeholder</div>;
    }

    default:
      return <NotFound />;
  }
}
