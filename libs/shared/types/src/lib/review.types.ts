export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export interface ReviewAuthorDto {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export interface ReviewDto {
  id: string;
  rating: number;
  title?: string | null;
  body: string;
  imageUrls: string[];
  status: ReviewStatus;
  adminReply?: string | null;
  repliedAt?: string | null;
  sellerReply?: string | null;
  sellerRepliedAt?: string | null;
  author: ReviewAuthorDto;
  createdAt: string;
}

export interface ReviewSummaryDto {
  productId: string;
  averageRating: number;
  totalReviews: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
