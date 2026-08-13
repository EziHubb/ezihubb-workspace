import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  FinancesOverviewDto,
  FinancesActivitySummaryDto,
  FinancesActivitiesDto,
  FinancesBankAccountDto,
  FinancesBillingCardDto,
  FinancesTaxInfoDto,
} from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

export function useFinancesOverview() {
  return useQuery({
    queryKey: queryKeys.financesOverview(),
    queryFn:  () => api.get<FinancesOverviewDto>(API_ROUTES.SELLER.FINANCES_OVERVIEW),
  });
}

export function useFinancesActivitySummary(month?: number, year?: number) {
  return useQuery({
    queryKey: queryKeys.financesSummary(month, year),
    queryFn:  () =>
      api.get<FinancesActivitySummaryDto>(API_ROUTES.SELLER.FINANCES_ACTIVITY_SUMMARY, {
        params: { month, year },
      }),
  });
}

export function useFinancesActivities(month?: number, year?: number, page = 1, limit = 25) {
  return useQuery({
    queryKey: queryKeys.financesActivities(month, year, page),
    queryFn:  () =>
      api.get<FinancesActivitiesDto>(API_ROUTES.SELLER.FINANCES_ACTIVITIES, {
        params: { month, year, page, limit },
      }),
  });
}

export function useFinancesBankAccount() {
  return useQuery({
    queryKey: queryKeys.financesBankAccount(),
    queryFn:  () => api.get<FinancesBankAccountDto | null>(API_ROUTES.SELLER.FINANCES_BANK_ACCOUNT),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      accountHolderName: string; bankName: string; accountNumber: string;
      country: string; depositSchedule: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    }) => api.patch<FinancesBankAccountDto>(API_ROUTES.SELLER.FINANCES_BANK_ACCOUNT, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.financesBankAccount() });
      qc.invalidateQueries({ queryKey: queryKeys.financesOverview() });
    },
  });
}

export function useFinancesBillingCards() {
  return useQuery({
    queryKey: queryKeys.financesBillingCards(),
    queryFn:  () => api.get<FinancesBillingCardDto[]>(API_ROUTES.SELLER.FINANCES_BILLING_CARDS),
  });
}

export function useCreateBillingSetupIntent() {
  return useMutation({
    mutationFn: () => api.post<{ clientSecret: string }>(API_ROUTES.SELLER.FINANCES_BILLING_SETUP_INTENT),
  });
}

export function useConfirmBillingCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stripePaymentMethodId: string) =>
      api.post<FinancesBillingCardDto>(API_ROUTES.SELLER.FINANCES_BILLING_CONFIRM, { stripePaymentMethodId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.financesBillingCards() });
      qc.invalidateQueries({ queryKey: queryKeys.financesOverview() });
    },
  });
}

export function useSetDefaultBillingCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<FinancesBillingCardDto[]>(API_ROUTES.SELLER.FINANCES_BILLING_CARD_DEFAULT(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.financesBillingCards() });
      qc.invalidateQueries({ queryKey: queryKeys.financesOverview() });
    },
  });
}

export function useDeleteBillingCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(API_ROUTES.SELLER.FINANCES_BILLING_CARD(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.financesBillingCards() });
      qc.invalidateQueries({ queryKey: queryKeys.financesOverview() });
    },
  });
}

export function useUpdateAutoBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => api.patch<{ enabled: boolean }>(API_ROUTES.SELLER.FINANCES_AUTO_BILLING, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.financesOverview() }),
  });
}

export function useUpdateCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: string) => api.patch<{ currency: string }>(API_ROUTES.SELLER.FINANCES_CURRENCY, { currency }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.financesOverview() }),
  });
}

export function useFinancesTaxInfo() {
  return useQuery({
    queryKey: queryKeys.financesTaxInfo(),
    queryFn:  () => api.get<FinancesTaxInfoDto | null>(API_ROUTES.SELLER.FINANCES_TAX_INFO),
  });
}

export function useUpdateTaxInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      sellerType: 'INDIVIDUAL' | 'BUSINESS'; fullLegalName: string; taxpayerId?: string;
      dateOfBirth?: string; country: string; streetAddress: string; flatOther?: string;
      city: string; province?: string; postCode?: string; phone?: string;
    }) => api.patch<FinancesTaxInfoDto>(API_ROUTES.SELLER.FINANCES_TAX_INFO, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.financesTaxInfo() }),
  });
}
