import type { ReviewSummaryDto } from '@mlh/types';
import { EtsyReviewsSection } from './EtsyReviewsSection';

interface ReviewsSectionProps {
  productSlug:   string;
  reviewSummary: ReviewSummaryDto | null;
}

export function ReviewsSection({ productSlug, reviewSummary }: ReviewsSectionProps) {
  return (
    <EtsyReviewsSection
      productSlug={productSlug}
      reviewSummary={reviewSummary}
    />
  );
}
