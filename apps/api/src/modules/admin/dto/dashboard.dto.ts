import { OrderStatus } from '@prisma/client';

export class DashboardKPIsDto {
  totalRevenue!: number;
  totalOrders!: number;
  totalCustomers!: number;
  averageOrderValue!: number;
  pendingOrders!: number;
  ordersInProduction!: number;
  pendingReviews!: number;
  revenueThisMonth!: number;
  ordersThisMonth!: number;
  newCustomersThisMonth!: number;
}

export class RevenueChartPointDto {
  date!: string;
  revenue!: number;
  orders!: number;
}

export class OrdersByStatusDto {
  status!: OrderStatus;
  count!: number;
  percentage!: number;
}

export class TopProductDto {
  productId!: string;
  name!: string;
  slug!: string;
  soldCount!: number;
  revenue!: number;
  imageUrl?: string | null;
}

/** Powers the Dashboard "search visibility" banner + shop-completeness
 *  checklist + "Top tasks" widgets, and is reused as-is by the dedicated
 *  /search-visibility and /customer-service-stats pages. */
export class ShopHealthDto {
  checklist!: {
    shopName:    boolean;
    logo:        boolean;
    banner:      boolean;
    story:       boolean;
    sellerPhoto: boolean;
  };
  /** Count of active listings whose title is short enough to likely hurt search (< 40 chars). */
  listingsNeedingTitleWork!: number;
  performanceScore!: number | null;
  scoreShipping!:    number | null;
  scoreRefund!:      number | null;
  scoreReview!:      number | null;
  scoreResponse!:    number | null;
  scoreBadge!:       string | null;
  topTasks!: {
    overdueOrders:     number;
    ordersToSendToday: number;
    helpRequests:      number;
    soldOutListings:   number;
    inactiveListings:  number;
  };
}
