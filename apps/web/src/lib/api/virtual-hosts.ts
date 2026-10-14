import { apiClient } from './client';

export const virtualHostsApi = {
  session: (callId: string) => apiClient(`/virtual-hosts/session/${callId}`),
  memory: (hostId: string) => apiClient(`/virtual-hosts/memory/${hostId}`),
};