'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Star, X, Upload, CheckCircle } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@mlh/ui';
import { apiClient, apiFetch } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Star selector ─────────────────────────────────────────────────────────────

function StarSelector({
  value,
  onChange,
  error,
}: {
  value:    number;
  onChange: (v: number) => void;
  error?:   string;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div>
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || value);
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
              className="w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
            >
              <Star
                className={[
                  'w-7 h-7 transition-colors duration-100',
                  filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300',
                ].join(' ')}
              />
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-error mt-1" role="alert">{error}</p>
      )}
    </div>
  );
}

// ── Photo upload strip ────────────────────────────────────────────────────────

interface UploadedPhoto {
  url:      string;
  uploading?: boolean;
}

function PhotoUpload({
  photos,
  onAdd,
  onRemove,
}: {
  photos:   UploadedPhoto[];
  onAdd:    (file: File) => void;
  onRemove: (idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { onAdd(file); e.target.value = ''; }
        }}
      />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-[60px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-sm text-sm text-muted hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Upload className="w-4 h-4" />
          📷 Add photos (optional)
          <span className="text-xs opacity-70">Up to 5 photos</span>
        </button>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative w-14 h-14 rounded-sm overflow-hidden bg-background border border-border">
              {p.uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <Image src={p.url} alt={`Photo ${i + 1}`} fill sizes="56px" className="object-cover" />
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-white"
                    aria-label="Remove photo"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </>
              )}
            </div>
          ))}
          {photos.length < 5 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-14 h-14 flex items-center justify-center border-2 border-dashed border-border rounded-sm text-muted hover:border-primary/50 hover:text-primary transition-colors"
              aria-label="Add another photo"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ReviewModalProps {
  isOpen:           boolean;
  productId:        string;
  orderId:          string;
  productName:      string;
  productImageUrl?: string;
  onSuccess:        () => void;
  onClose:          () => void;
}

// ── Guard result ──────────────────────────────────────────────────────────────

type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: 'not_purchased' | 'already_reviewed' };

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewModal({
  isOpen,
  productId,
  orderId,
  productName,
  productImageUrl,
  onSuccess,
  onClose,
}: ReviewModalProps) {
  const [guardState,  setGuardState]  = useState<'loading' | GuardResult>('loading');
  const [rating,      setRating]      = useState(0);
  const [ratingError, setRatingError] = useState('');
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [bodyError,   setBodyError]   = useState('');
  const [photos,      setPhotos]      = useState<UploadedPhoto[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted,   setSubmitted]   = useState(false);

  // ── Guard check on open ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    setGuardState('loading');
    setSubmitted(false);
    setRating(0);
    setTitle('');
    setBody('');
    setPhotos([]);
    setSubmitError('');

    apiClient
      .get<GuardResult>(API_ROUTES.REVIEWS.CAN_REVIEW, {
        params: { productId, orderId },
      })
      .then((d) => setGuardState(d))
      .catch(() => setGuardState({ allowed: false, reason: 'not_purchased' }));
  }, [isOpen, productId, orderId]);

  // ── Photo upload ────────────────────────────────────────────────────────

  const handlePhotoAdd = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return;

    const placeholder: UploadedPhoto = { url: URL.createObjectURL(file), uploading: true };
    setPhotos((prev) => [...prev, placeholder]);
    const idx = photos.length;

    try {
      const form = new FormData();
      form.append('file', file);
      const result = await apiFetch<{ url: string }>(API_ROUTES.REVIEWS.UPLOAD_IMAGE, {
        method: 'POST', body: form as unknown as BodyInit,
      });
      const url: string = (result as { url: string })?.url ?? placeholder.url;
      setPhotos((prev) => prev.map((p, i) => i === idx ? { url, uploading: false } : p));
    } catch {
      setPhotos((prev) => prev.filter((_, i) => i !== idx));
    }
  }, [photos.length]);

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    let valid = true;

    if (rating === 0) { setRatingError('Please select a rating'); valid = false; }
    else setRatingError('');

    if (!body.trim() || body.trim().length < 20) {
      setBodyError('Review must be at least 20 characters'); valid = false;
    } else setBodyError('');

    if (!valid) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      await apiClient.post(API_ROUTES.REVIEWS.LIST, {
        productId,
        orderId,
        rating,
        title:     title.trim() || undefined,
        body:      body.trim(),
        imageUrls: photos.filter((p) => !p.uploading).map((p) => p.url),
      });

      setSubmitted(true);
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const BODY_MAX = 1000;

  return (
    <Modal isOpen={isOpen} onClose={submitting ? () => undefined : onClose} size="md">
      <ModalHeader onClose={submitting ? undefined : onClose}>
        Write a Review
      </ModalHeader>

      <ModalBody>
        {/* Loading guard */}
        {guardState === 'loading' && (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Not allowed */}
        {guardState !== 'loading' && !guardState.allowed && (
          <div className="py-6 text-center space-y-2">
            <p className="text-2xl">ℹ️</p>
            <p className="text-sm font-medium text-secondary">
              {guardState.reason === 'already_reviewed'
                ? "You've already reviewed this product."
                : 'You can only review products you\'ve purchased.'}
            </p>
          </div>
        )}

        {/* Success state */}
        {submitted && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-success mx-auto" />
            <p className="text-base font-semibold text-secondary">Review submitted!</p>
            <p className="text-sm text-muted">
              Your review will appear after approval (usually within 24 hours).
            </p>
          </div>
        )}

        {/* Form */}
        {guardState !== 'loading' && guardState.allowed && !submitted && (
          <div className="space-y-5">
            {/* Product row */}
            <div className="flex items-center gap-3 p-3 rounded-sm bg-background border border-border">
              {productImageUrl && (
                <div className="relative w-12 h-12 rounded-sm overflow-hidden shrink-0 bg-border/20">
                  <Image src={productImageUrl} alt={productName} fill sizes="48px" className="object-cover" />
                </div>
              )}
              <p className="text-sm font-medium text-secondary truncate">{productName}</p>
            </div>

            {/* Star rating */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-secondary">
                Your Rating <span className="text-error">*</span>
              </p>
              <StarSelector
                value={rating}
                onChange={(v) => { setRating(v); setRatingError(''); }}
                error={ratingError}
              />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-secondary" htmlFor="review-title">
                Review Title <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="review-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Summarize your experience…"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-sm bg-surface text-secondary placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-secondary" htmlFor="review-body">
                  Your Review <span className="text-error">*</span>
                </label>
                <span className={`text-xs tabular-nums ${body.length > BODY_MAX ? 'text-error' : 'text-muted'}`}>
                  {body.length} / {BODY_MAX}
                </span>
              </div>
              <textarea
                id="review-body"
                value={body}
                onChange={(e) => { setBody(e.target.value); if (bodyError) setBodyError(''); }}
                maxLength={BODY_MAX}
                rows={4}
                placeholder="What did you love about this product? (at least 20 characters)"
                className={[
                  'w-full px-3 py-2.5 text-sm border rounded-sm bg-surface text-secondary',
                  'placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'focus:border-primary transition-colors resize-none',
                  bodyError ? 'border-error' : 'border-border',
                ].join(' ')}
              />
              {bodyError && <p className="text-xs text-error" role="alert">{bodyError}</p>}
            </div>

            {/* Photos */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-secondary">Photos (optional)</p>
              <PhotoUpload
                photos={photos}
                onAdd={handlePhotoAdd}
                onRemove={(i) => setPhotos((p) => p.filter((_, idx) => idx !== i))}
              />
            </div>

            {submitError && (
              <p className="text-xs text-error" role="alert">{submitError}</p>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {submitted ? (
          <Button variant="primary" onClick={onClose} fullWidth>
            Close
          </Button>
        ) : guardState !== 'loading' && !guardState.allowed ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : guardState !== 'loading' && guardState.allowed && (
          <>
            <p className="text-xs text-muted flex-1">
              Reviews are publicly visible after approval.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              loading={submitting}
            >
              Submit Review
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
