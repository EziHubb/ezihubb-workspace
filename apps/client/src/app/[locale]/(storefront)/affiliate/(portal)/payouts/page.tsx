'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { Badge, Button, Input, Modal, ModalBody, ModalFooter, ModalHeader, Pagination, Select } from '@ezihubb/ui';
import { formatCapturedUsd as money, minorToUsdInput, usdInputToMinor } from '@ezihubb/utils';
import { useAuthStore } from '../../../../../../lib/store/auth.store';

type Balance = { availableMinor: string; pendingMinor: string; heldMinor: string; reservedMinor: string; paidMinor: string; debtMinor: string; minimumPayoutMinor: string; payoutRequestsEnabled: boolean };
type Payout = { id: string; state: string; amountMinor: string; createdAt: string; allocations: { lotId: string; captureId: string; sourceKey: string; amountMinor: string }[] };
type Pending = { idempotencyKey: string; amountMinor: string };

export default function AffiliatePayoutsPage() {
  const userId = useAuthStore(s => s.user?.id), token = useAuthStore(s => s.accessToken);
  const [mode, setMode] = useState<'LIVE' | 'TEST'>('LIVE');
  const vi = useLocale() === 'vi';
  return <div className="space-y-6 text-secondary">
    <div className="flex flex-wrap justify-between gap-4">
      <h1 className="font-display text-2xl font-bold">{vi ? 'Số dư và yêu cầu chi trả' : 'Verified balances & payouts'}</h1>
      <label htmlFor="affiliate-money-mode" className="flex gap-3 items-center">{vi ? 'Môi trường' : 'Environment'}
        <Select id="affiliate-money-mode" value={mode} onChange={e => setMode(e.target.value as 'LIVE' | 'TEST')} options={[{ value: 'LIVE', label: 'LIVE' }, { value: 'TEST', label: 'TEST / sandbox' }]} />
      </label>
    </div>
    {userId && token ? <CapturedAccount key={`${userId}:${mode}`} userId={userId} token={token} mode={mode} vi={vi} /> : <p role="status">{vi ? 'Đang tải tài khoản…' : 'Loading account…'}</p>}
  </div>;
}

function CapturedAccount({ userId, token, mode, vi }: { userId: string; token: string; mode: 'LIVE' | 'TEST'; vi: boolean }) {
  const qc = useQueryClient(), [page, setPage] = useState(1);
  const [amount, setAmount] = useState(''), [pending, setPending] = useState<Pending | null>(null);
  const [ready, setReady] = useState(false), [review, setReview] = useState(false), [feedback, setFeedback] = useState('');
  const [storageError, setStorageError] = useState(false);
  const sending = useRef(false);
  const key = ['affiliate-captured', userId, mode], storageKey = `affiliate-payout:${userId}:${mode}`;
  const prefix = '/affiliates/me/economic', params = { currency: 'USD', provenance: mode };
  const balance = useQuery({ queryKey: [...key, 'overview'], queryFn: () => apiClient.get<Balance>(`${prefix}/overview`, { token, params }), retry: false });
  const history = useQuery({ queryKey: [...key, 'payouts', page], queryFn: () => apiClient.get<{ data: Payout[]; total: number }>(`${prefix}/payouts`, { token, params: { ...params, page, limit: 20 } }), retry: false });
  const legacy = useQuery({ queryKey: ['affiliate-legacy-payouts', userId], queryFn: () => apiClient.get<{ id: string; amount: string | number; status: string }[]>('/affiliates/me/payouts', { token }), retry: false });
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved: Pending = JSON.parse(raw);
        if (typeof saved.idempotencyKey !== 'string' || !/^[1-9]\d{0,18}$/.test(saved.amountMinor)) throw new Error('Invalid saved request');
        setPending(saved); setAmount(minorToUsdInput(saved.amountMinor));
      }
      setReady(true);
    } catch { setStorageError(true); }
  }, [storageKey]);
  const mutation = useMutation({ mutationFn: async () => {
    const amountMinor = usdInputToMinor(amount);
    if (!amountMinor) throw new Error('Invalid amount');
    const request = pending ?? { amountMinor, idempotencyKey: crypto.randomUUID() };
    sessionStorage.setItem(storageKey, JSON.stringify(request)); setPending(request);
    await apiClient.post(`${prefix}/payouts`, { ...request, ...params }, { token });
    sessionStorage.removeItem(storageKey); setPending(null); setAmount('');
  }, onSuccess: () => { setReview(false); setFeedback(vi ? 'Đã ghi nhận yêu cầu. Tiền được giữ cho yêu cầu này, chưa có chuyển tiền.' : 'Request recorded. Funds are reserved; no transfer has been sent.'); },
  onSettled: () => { sending.current = false; return qc.invalidateQueries({ queryKey: key }); } });
  const data = balance.data, minor = usdInputToMinor(amount);
  const allowed = ready && !balance.isError && !balance.isFetching && data?.payoutRequestsEnabled && minor !== null
    && BigInt(minor) >= BigInt(data.minimumPayoutMinor) && BigInt(minor) <= BigInt(data.availableMinor);
  const failure = vi ? 'Chưa xác nhận được kết quả. Hãy thử lại cùng yêu cầu; không tạo yêu cầu chuyển tiền khác.' : 'The result could not be confirmed. Retry the same request; do not create another transfer.';
  return <div className="space-y-6">
    <div className="border border-border rounded-card bg-surface p-5 space-y-2">
      <p className="font-semibold">{mode} · USD {mode === 'TEST' ? '(sandbox)' : ''}</p>
      <p>{vi ? 'Chỉ tính tiền đã thu được xác minh. Hoa hồng chờ điều kiện giao hàng và thời gian giữ theo chính sách đã lưu của từng đơn.' : 'Only verified captured funds are included. Commissions become eligible after delivery and the lock period saved with each order.'}</p>
      <p>{vi ? 'Dữ liệu cũ chưa đối soát không được cộng vào số dư khả dụng.' : 'Unreconciled legacy records are excluded from available funds.'}</p>
    </div>
    {balance.isError ? <div role="alert">{vi ? 'Không tải được số dư. Không giả định số dư bằng 0.' : 'Balance unavailable. No zero balance has been assumed.'}<Button type="button" variant="secondary" className="ml-3" onClick={() => void balance.refetch()}>{vi ? 'Thử lại' : 'Retry'}</Button></div>
      : !data ? <p role="status">{vi ? 'Đang tải số dư…' : 'Loading verified balance…'}</p> : <>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[
          [vi ? 'Khả dụng' : 'Available', data.availableMinor], [vi ? 'Chờ đủ điều kiện' : 'Pending eligibility', data.pendingMinor],
          [vi ? 'Đang giữ' : 'Held', data.heldMinor], [vi ? 'Đã dành cho chi trả' : 'Reserved', data.reservedMinor],
          [vi ? 'Đã chi trả' : 'Paid out', data.paidMinor], [vi ? 'Khoản nợ' : 'Debt', data.debtMinor],
        ].map(([label, value]) => <div key={label} className="p-5 border border-border rounded-card bg-surface min-w-0"><dt className="text-sm text-muted">{label}</dt><dd className="font-display text-2xl font-bold mt-2 tabular-nums break-words">{money(value)}</dd></div>)}</dl>
        <form className="border border-border rounded-card p-5 space-y-3" onSubmit={e => { e.preventDefault(); if (pending || allowed) { mutation.reset(); setReview(true); } }}>
          <h2 className="font-semibold">{vi ? 'Yêu cầu chi trả' : 'Request payout'}</h2>
          <p>{vi ? 'Tối thiểu' : 'Minimum'} {money(data.minimumPayoutMinor)}. {vi ? 'Tài khoản nhận tiền được xác minh riêng, không thay đổi tại đây.' : 'Recipient details are verified separately and cannot be changed here.'}</p>
          {!data.payoutRequestsEnabled && <p>{vi ? 'Yêu cầu chi trả chưa được bật hoặc chưa có tài khoản nhận đã xác minh.' : 'Requests are disabled or a verified recipient is not configured.'}</p>}
          {pending && <p role="status">{vi ? 'Có yêu cầu đang chờ xác nhận. Thử lại sẽ giữ nguyên số tiền và mã yêu cầu.' : 'An earlier request is unconfirmed. Retrying keeps its original amount and key.'}</p>}
          <Input label={vi ? 'Số tiền (USD)' : 'Amount (USD)'} id="affiliate-payout-amount" fullWidth className="min-h-11" value={amount} inputMode="decimal" readOnly={!!pending} onChange={e => setAmount(e.target.value)} required />
          <Button type="submit" disabled={!ready || mutation.isPending || (!pending && !allowed)}>{pending ? (vi ? 'Thử lại cùng yêu cầu' : 'Retry same request') : (vi ? 'Kiểm tra yêu cầu' : 'Review request')}</Button>
        </form>
      </>}
    {storageError && <p role="alert">{vi ? 'Không khôi phục được yêu cầu trong trình duyệt. Liên hệ hỗ trợ trước khi tạo yêu cầu mới.' : 'Cannot recover browser request state. Contact support before creating another request.'}</p>}
    {feedback && <p role="status">{feedback}</p>}
    <section className="space-y-4"><h2 className="text-lg font-semibold">{vi ? 'Lịch sử chi trả đã xác minh' : 'Captured payout history'}</h2>
      {history.isError ? <p role="alert">{vi ? 'Không tải được lịch sử.' : 'History unavailable.'}<Button type="button" variant="secondary" className="ml-3" onClick={() => void history.refetch()}>{vi ? 'Thử lại' : 'Retry'}</Button></p>
        : !history.data ? <p role="status">{vi ? 'Đang tải…' : 'Loading…'}</p> : <>
          {!history.data.data.length && <p>{vi ? 'Chưa có yêu cầu ở môi trường này.' : 'No requests in this mode.'}</p>}
          {history.data.data.map(row => <article key={row.id} className="border border-border rounded-card bg-surface p-5 space-y-2 break-words">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{row.id} · {money(row.amountMinor)}</h3><Badge variant={row.state === 'PAID' ? 'COMPLETED' : row.state === 'REJECTED' ? 'DISPUTED' : 'PENDING_PAYMENT'}>{row.state}</Badge></div>
            <p>{new Date(row.createdAt).toLocaleString(vi ? 'vi-VN' : 'en-US')}</p>
            <details><summary className="py-2 cursor-pointer">{vi ? 'Phân bổ chi tiết' : 'Exact allocations'}</summary>{row.allocations.map(part => <p key={part.lotId}>{part.captureId} / {part.sourceKey} · {money(part.amountMinor)}</p>)}</details>
          </article>)}
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(history.data.total / 20))} onPageChange={setPage} labels={vi ? { navAria: 'Phân trang chi trả', previousAria: 'Trang trước', nextAria: 'Trang sau', prev: 'Trước', next: 'Sau', pageOf: (current, total) => `Trang ${current} / ${total}`, pageAria: current => `Trang ${current}` } : undefined} />
        </>}
    </section>
    <details className="border border-border rounded-card p-5"><summary className="py-2 cursor-pointer">{vi ? 'Lịch sử cũ — chỉ đối soát' : 'Legacy history — reconciliation only'}</summary>
      <p>{vi ? 'Giữ nguyên dữ liệu lịch sử, không xác nhận đã thu hoặc đã chuyển tiền. Không thể thao tác chi trả từ các bản ghi này.' : 'Historical labels are retained, not proof of capture or transfer. These records cannot fund new payouts.'}</p>
      {legacy.isError ? <p role="alert">{vi ? 'Không tải được lịch sử cũ.' : 'Legacy history unavailable.'}</p> : !legacy.data ? <p role="status">{vi ? 'Đang tải…' : 'Loading…'}</p> : legacy.data.map(row => <p className="mt-3 break-words" key={row.id}>{row.id} · {String(row.amount)} USD · {row.status}</p>)}
    </details>
    {review && <Modal isOpen native dismissible={!mutation.isPending} closeOnOverlayClick={false} aria-labelledby="affiliate-payout-confirm-title" onClose={() => setReview(false)}>
      <form className="flex min-h-0 flex-col" onSubmit={e => { e.preventDefault(); if (!sending.current) { sending.current = true; mutation.mutate(); } }}>
        <ModalHeader><h2 id="affiliate-payout-confirm-title">{vi ? 'Xác nhận yêu cầu chi trả' : 'Confirm payout request'}</h2></ModalHeader>
        <ModalBody className="space-y-4 text-sm text-secondary">
        <p>{mode} · {money(pending?.amountMinor ?? minor ?? '0')}</p><p>{vi ? 'Thao tác này giữ tiền cho yêu cầu, không thực hiện chuyển tiền.' : 'This reserves funds for your request; it does not send a transfer.'}</p>
        {mutation.isError && <p role="alert">{failure}</p>}
        </ModalBody>
        <ModalFooter className="flex-wrap"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => setReview(false)}>{vi ? 'Hủy' : 'Cancel'}</Button><Button type="submit" loading={mutation.isPending}>{mutation.isPending ? (vi ? 'Đang kiểm tra…' : 'Checking…') : (vi ? 'Xác nhận' : 'Confirm')}</Button></ModalFooter>
      </form>
    </Modal>}
  </div>;
}
