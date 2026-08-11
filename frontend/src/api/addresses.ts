import type { ApiAddress } from '../types/api';
import { api } from './client';

export interface AddressInput {
  fullName: string;
  phone: string;
  line1: string;
  ward: string;
  district: string;
  province: string;
  isDefault?: boolean;
}

export const addressApi = {
  list: () => api.get<{ addresses: ApiAddress[] }>('/api/addresses'),

  create: (input: AddressInput) => api.post<{ address: ApiAddress }>('/api/addresses', input),

  update: (id: number, input: Partial<Omit<AddressInput, 'isDefault'>>) =>
    api.patch<{ address: ApiAddress }>(`/api/addresses/${id}`, input),

  setDefault: (id: number) => api.post<{ address: ApiAddress }>(`/api/addresses/${id}/default`),

  remove: (id: number) => api.delete<void>(`/api/addresses/${id}`),
};
