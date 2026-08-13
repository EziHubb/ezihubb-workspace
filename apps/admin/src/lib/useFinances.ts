import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  FinancesOverviewDto,
  FinancesActivitySummaryDto,
  FinancesActivitiesDto,
  FinancesBankAccountDto,
  FinancesBillingCardDto,
  FinancesTaxInfoDto,
} from '@ezihubb/types';

/**
 * Admin-app mirror of libs/shared/api-client/src/hooks/useFinances.ts — same
 * shape, but calling the admin-scoped `/admin/finances/*` routes (resolved
 * via StoreContextService server-side, so this also works for a SUPER_ADMIN
 * in "My Store" mode) through this app's own axios client instead of the
 * client app's Zustand-auth-backed one.
 */

const QK = {
  overview:      () => ['admin-finances-overview'],
  summary:       (month?: number, year?: number) => ['admin-finances-summary', month, year],
  activities:    (month?: number, year?: number, page?: number) => ['admin-finances-activities', month, year, page],
  bankAccount:   () => ['admin-finances-bank-account'],
  billingCards:  () => ['admin-finances-billing-cards'],
  taxInfo:       () => ['admin-finances-tax-info'],
};

export function useFinancesOverview() {
  return useQuery({
    queryKey: QK.overview(),
    queryFn:  () => api.get<FinancesOverviewDto>(API_ROUTES.ADMIN.FINANCES_OVERVIEW),
  });
}

export function useFinancesActivitySummary(month?: number, year?: number) {
  return useQuery({
    queryKey: QK.summary(month, year),
    queryFn:  () =>
      api.get<FinancesActivitySummaryDto>(API_ROUTES.ADMIN.FINANCES_ACTIVITY_SUMMARY, {
        params: { month, year },
      }),
  });
}

export function useFinancesActivities(month?: number, year?: number, page = 1, limit = 25) {
  return useQuery({
    queryKey: QK.activities(month, year, page),
    queryFn:  () =>
      api.get<FinancesActivitiesDto>(API_ROUTES.ADMIN.FINANCES_ACTIVITIES, {
        params: { month, year, page, limit },
      }),
  });
}

export function useFinancesBankAccount() {
  return useQuery({
    queryKey: QK.bankAccount(),
    queryFn:  () => api.get<FinancesBankAccountDto | null>(API_ROUTES.ADMIN.FINANCES_BANK_ACCOUNT),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      accountHolderName: string; bankName: string; accountNumber: string;
      country: string; depositSchedule: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    }) => api.patch<FinancesBankAccountDto>(API_ROUTES.ADMIN.FINANCES_BANK_ACCOUNT, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.bankAccount() });
      qc.invalidateQueries({ queryKey: QK.overview() });
    },
  });
}

export function useFinancesBillingCards() {
  return useQuery({
    queryKey: QK.billingCards(),
    queryFn:  () => api.get<FinancesBillingCardDto[]>(API_ROUTES.ADMIN.FINANCES_BILLING_CARDS),
  });
}

export function useSetDefaultBillingCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<FinancesBillingCardDto[]>(API_ROUTES.ADMIN.FINANCES_BILLING_CARD_DEFAULT(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.billingCards() });
      qc.invalidateQueries({ queryKey: QK.overview() });
    },
  });
}

export function useDeleteBillingCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(API_ROUTES.ADMIN.FINANCES_BILLING_CARD(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.billingCards() });
      qc.invalidateQueries({ queryKey: QK.overview() });
    },
  });
}

export function useUpdateAutoBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.patch<{ enabled: boolean }>(API_ROUTES.ADMIN.FINANCES_AUTO_BILLING, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.overview() }),
  });
}

export function useUpdateCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) => api.patch<{ currency: string }>(API_ROUTES.ADMIN.FINANCES_CURRENCY, { currency }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.overview() }),
  });
}

export function useFinancesTaxInfo() {
  return useQuery({
    queryKey: QK.taxInfo(),
    queryFn:  () => api.get<FinancesTaxInfoDto | null>(API_ROUTES.ADMIN.FINANCES_TAX_INFO),
  });
}

export function useUpdateTaxInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      sellerType: 'INDIVIDUAL' | 'BUSINESS'; fullLegalName: string; taxpayerId?: string;
      dateOfBirth?: string; country: string; streetAddress: string; flatOther?: string;
      city: string; province?: string; postCode?: string; phone?: string;
    }) => api.patch<FinancesTaxInfoDto>(API_ROUTES.ADMIN.FINANCES_TAX_INFO, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.taxInfo() }),
  });
}
