export type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

export interface ReviewDto {
  id:         string;
  productId:  string;
  orderId:    string;
  userId:     string;
  rating:     number;
  title?:     string;
  body:       string;
  images?:    string[];
  status:     ReviewStatus;
  adminReply?: string;
  repliedAt?:  string;
  user?: {
    firstName: string;
    lastName:  string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummaryDto {
  productId:     string;
  averageRating: number;
  totalReviews:  number;
  distribution:  Record<1 | 2 | 3 | 4 | 5, number>;
}
