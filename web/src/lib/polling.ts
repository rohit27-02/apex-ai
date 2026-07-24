'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRun } from './api';
import type { ValidatedRun } from './validation';

export function useRunPolling(runId: string | null) {
  return useQuery<ValidatedRun>({
    queryKey: ['run', runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'success' || status === 'failure' || status === 'stopped') {
        return false;
      }
      return 1000;
    },
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}
