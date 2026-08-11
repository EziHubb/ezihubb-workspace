import { ReviewStatus } from '@prisma/client';

export class ReviewAuthorDto {
  id!: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export class ReviewResponseDto {
  id!: string;
  rating!: number;
  title?: string | null;
  body!: string;
  imageUrls!: string[];
  status!: ReviewStatus;
  adminReply?:      string | null;
  repliedAt?:       Date | null;
  sellerReply?:     string | null;
  sellerRepliedAt?: Date | null;
  createdAt!:       Date;
  author!:          ReviewAuthorDto;
}

export class AdminReviewResponseDto {
  id!: string;
  userId!: string;
  orderId?: string | null;
  productId?: string | null;
  rating!: number;
  title?: string | null;
  body!: string;
  imageUrls!: string[];
  status!: ReviewStatus;
  adminReply?: string | null;
  repliedAt?: Date | null;
  createdAt!: Date;
  customerName!: string;
  customerEmail!: string;
  customerAvatarUrl?: string | null;
  productName!: string;
  productSlug!: string;
  productImageUrl?: string | null;
  categoryName?: string | null;
  store?: { id: string; name: string; slug: string } | null;
}

export class ReviewSummaryDto {
  productId!: string;
  averageRating!: number;
  totalReviews!: number;
  distribution!: Record<1 | 2 | 3 | 4 | 5, number>;
}

export class AdminReplyDto {
  reply!: string;
}
