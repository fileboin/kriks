import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import {
  ESCROW_ACTION_KIND,
  ESCROW_KIND,
  type EscrowAction,
  type EscrowContract,
  type EscrowState,
} from '@/lib/escrow/types';
import {
  deriveEscrowState,
  escrowCoordinate,
  parseEscrowAction,
  parseEscrowContract,
} from '@/lib/escrow/core';

function parseContracts(events: NostrEvent[]): EscrowContract[] {
  return events
    .map(parseEscrowContract)
    .filter((contract): contract is EscrowContract => contract !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** All escrows involving the logged-in user (as buyer, seller or arbiter), with derived state. */
export function useMyEscrowStates() {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();

  const contractsQuery = useQuery<EscrowContract[]>({
    queryKey: ['escrow', 'mine', user?.pubkey ?? ''],
    queryFn: async (c) => {
      if (!user) return [];
      // `p` tags are ordered [buyer, seller, arbiter] — participation filter.
      const events = await nostr.query(
        [{ kinds: [ESCROW_KIND], '#p': [user.pubkey], limit: 50 }],
        { signal: c.signal },
      );
      return parseContracts(events);
    },
    enabled: user !== undefined,
    staleTime: 30_000,
  });

  const contracts = contractsQuery.data ?? [];
  const coordinates = useMemo(
    () => contracts.map((contract) => contract.coordinate).sort(),
    [contracts],
  );

  const actionsQuery = useQuery<EscrowAction[]>({
    queryKey: ['escrow', 'actions', ...coordinates],
    queryFn: async (c) => {
      if (coordinates.length === 0) return [];
      const events = await nostr.query(
        [{ kinds: [ESCROW_ACTION_KIND], '#a': coordinates, limit: 300 }],
        { signal: c.signal },
      );
      return events
        .map(parseEscrowAction)
        .filter((action): action is EscrowAction => action !== null);
    },
    enabled: coordinates.length > 0,
    staleTime: 30_000,
  });

  const states = useMemo(() => {
    const actionsByCoordinate = new Map<string, NostrEvent[]>();
    for (const action of actionsQuery.data ?? []) {
      const list = actionsByCoordinate.get(action.coordinate) ?? [];
      list.push(action.event);
      actionsByCoordinate.set(action.coordinate, list);
    }
    return contracts.map((contract) => ({
      state: deriveEscrowState(contract, actionsByCoordinate.get(contract.coordinate) ?? []),
      contract,
    }));
  }, [contracts, actionsQuery.data]);

  return {
    states,
    isPending: contractsQuery.isPending || (coordinates.length > 0 && actionsQuery.isPending),
    isError: contractsQuery.isError,
    refetch: () => void contractsQuery.refetch(),
  };
}

/** A single escrow by its addressable coordinate parts, with derived state. */
export function useEscrowDetail(initiator: string, d: string) {
  const { nostr } = useNostr();
  const coordinate = escrowCoordinate(initiator, d);

  return useQuery<EscrowState | null>({
    queryKey: ['escrow', 'detail', initiator, d],
    queryFn: async (c) => {
      const events = await nostr.query(
        [
          // Author constraint — the `d` tag alone is not a trust boundary.
          { kinds: [ESCROW_KIND], authors: [initiator], '#d': [d], limit: 1 },
          { kinds: [ESCROW_ACTION_KIND], '#a': [coordinate], limit: 200 },
        ],
        { signal: c.signal },
      );

      const contractEvent = events.find((event) => event.kind === ESCROW_KIND);
      if (!contractEvent) return null;

      const contract = parseEscrowContract(contractEvent);
      if (!contract) return null;

      return deriveEscrowState(contract, events);
    },
    staleTime: 15_000,
  });
}
