'use client';

import { useState } from 'react';
import { CreditCard, Check, X } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@mlh/ui';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Gift card visual ──────────────────────────────────────────────────────────

function GiftCardVisual({
  code,
  balance,
  originalBalance,
}: {
  code:            string;
  balance:         number;
  originalBalance?: number;
}) {
  return (
    <div className="relative w-[140px] h-[80px] rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white p-3 shadow-md overflow-hidden shrink-0">
      {/* Decorative circle */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-white/5" />

      <CreditCard className="w-5 h-5 opacity-70 relative z-10" />
      <p className="text-[9px] font-mono tracking-wider opacity-80 mt-1 relative z-10 truncate">
        {code.toUpperCase()}
      </p>
      <p className="text-sm font-bold relative z-10">${balance.toFixed(2)}</p>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GiftCardBalanceModalProps {
  isOpen:    boolean;
  onApply:   (code: string, balance: number) => void;
  onClose:   () => void;
  alreadyAppliedCode?: string;
  onRemove?: () => void;
}

interface ValidResult {
  balance:         number;
  originalBalance?: number;
  currency:        string;
  expiresAt?:      string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GiftCardBalanceModal({
  isOpen,
  onApply,
  onClose,
  alreadyAppliedCode,
  onRemove,
}: GiftCardBalanceModalProps) {
  const [code,        setCode]        = useState('');
  const [checking,    setChecking]    = useState(false);
  const [validResult, setValidResult] = useState<ValidResult | null>(null);
  const [error,       setError]       = useState('');

  const reset = () => {
    setCode('');
    setValidResult(null);
    setError('');
  };

  const handleCheck = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Please enter a gift card code.'); return; }

    setChecking(true);
    setError('');
    setValidResult(null);

    try {
      const data = await apiClient.get<ValidResult>(
        API_ROUTES.PAYMENTS.GIFT_CARD_VALIDATE_CODE(trimmed),
      );

      if (!data?.balance || data.balance <= 0) {
        setError('This gift card has no remaining balance.');
        return;
      }

      setValidResult(data);
    } catch {
      setError('Could not validate gift card. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
    >
      <ModalHeader onClose={onClose}>Gift Card</ModalHeader>

      <ModalBody>
        <div className="space-y-5">
          {/* Already applied banner */}
          {alreadyAppliedCode && (
            <div className="flex items-center justify-between p-3 rounded-sm bg-success/5 border border-success/20">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-secondary">
                    Gift card applied
                  </p>
                  <p className="text-xs font-mono text-muted">
                    {alreadyAppliedCode}
                  </p>
                </div>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="text-xs text-error hover:underline font-medium"
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {/* Code input */}
          {!alreadyAppliedCode && (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (error) setError('');
                    if (validResult) setValidResult(null);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
                  placeholder="GIFT-XXXX-XXXX"
                  maxLength={24}
                  spellCheck={false}
                  className={[
                    'flex-1 px-3 py-2.5 text-sm font-mono border rounded-sm bg-surface text-secondary',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                    'placeholder:text-muted/50 tracking-wider uppercase transition-colors',
                    error ? 'border-error' : 'border-border',
                  ].join(' ')}
                />
                <Button
                  variant="secondary"
                  onClick={handleCheck}
                  loading={checking}
                  disabled={!code.trim()}
                >
                  Check
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-1.5">
                  <X className="w-3.5 h-3.5 text-error shrink-0" />
                  <p className="text-xs text-error">{error}</p>
                </div>
              )}

              {/* Valid result */}
              {validResult && !error && (
                <div className="flex items-start gap-4 p-4 rounded-sm bg-primary-light border border-primary/15">
                  <GiftCardVisual
                    code={code}
                    balance={validResult.balance}
                    originalBalance={validResult.originalBalance}
                  />
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-primary">
                      ${validResult.balance.toFixed(2)}
                    </p>
                    {validResult.originalBalance && (
                      <p className="text-xs text-muted">
                        of ${validResult.originalBalance.toFixed(2)} original
                      </p>
                    )}
                    <p className="text-xs text-muted">Never expires</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
          Cancel
        </Button>
        {validResult && (
          <Button
            variant="primary"
            onClick={() => {
              onApply(code.trim(), validResult.balance);
              reset();
              onClose();
            }}
          >
            Apply to Order
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
