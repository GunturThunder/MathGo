import { QueryClient, useQuery } from '@tanstack/react-query';
import { api, SessionEndedError } from './index';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A refused session is not worth retrying; network errors are.
      retry: (failures, error) => !(error instanceof SessionEndedError) && failures < 2,
    },
  },
});

export const meQueryKey = ['me'] as const;

/** The signed-in player, or nothing before the first launch flow (S3-08) has run. */
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.me(),
    enabled: api.session !== null,
  });
}
