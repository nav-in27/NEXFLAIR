import { useQuery } from '@tanstack/react-query';
import { fetchHealthStatus } from '../services/api';
import { HealthStatus } from '../types/health';

export function useHealth() {
  return useQuery<HealthStatus, Error>({
    queryKey: ['health'],
    queryFn: fetchHealthStatus,
    refetchInterval: 10000,
  });
}
