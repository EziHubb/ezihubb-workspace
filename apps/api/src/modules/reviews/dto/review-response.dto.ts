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

export class ReviewSummaryDto {
  productId!: string;
  averageRating!: number;
  totalReviews!: number;
  distribution!: Record<1 | 2 | 3 | 4 | 5, number>;
}

export class AdminReplyDto {
  reply!: string;
}
