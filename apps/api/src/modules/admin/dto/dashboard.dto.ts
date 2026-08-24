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
/**
 * The counts the sidebar shows beside Orders and Messages.
 *
 * Both mean "newly arrived and not looked at", not "unfinished" — a badge that
 * stays lit while work is in progress is one the seller stops reading.
 */
export class NavBadgesDto {
  /** Threads with something unread, matching the inbox's own Unread folder. */
  unreadMessages!:  number;
  /** Orders sitting on the queue's first step, or not yet placed on one. */
  ordersToProcess!: number;
}

export class ShopHealthDto {
  /** Already-fetched by the same `store.findUnique` the checklist booleans derive
   *  from — exposed as-is so the Dashboard header can render a real greeting
   *  instead of the generic page title. */
  shopName!:        string | null;
  shopSlug!:        string | null;
  shopLogoUrl!:     string | null;
  activeListings!:  number;
  checklist!: {
    shopName:    boolean;
    logo:        boolean;
    banner:      boolean;
    story:       boolean;
    sellerPhoto: boolean;
  };
  /**
   * What still stands between this shop and its first sale.
   *
   * Separate from `checklist`, which is about how the shop LOOKS. These are
   * the things that decide whether it can transact at all: a listing with no
   * delivery profile has no shipping price to quote at checkout, and a shop
   * still awaiting review cannot be bought from however finished it looks.
   *
   * Booleans only, no copy or links — the same contract `checklist` already
   * uses. Wording belongs with the component that renders it.
   */
  setup!: {
    /** At least one ACTIVE, non-deleted listing. */
    firstListing:      boolean;
    /** At least one shipping profile, without which checkout cannot quote. */
    deliveryProfile:   boolean;
    /** At least one processing profile — drives the dispatch estimate. */
    processingProfile: boolean;
    /** At least one shop section. Organisational, not blocking. */
    shopSection:       boolean;
  };
  /**
   * Whether the shop is approved to sell.
   *
   * Deliberately NOT a member of `setup`: nothing the seller does moves it, so
   * rendering it as an unticked task would be telling them to do something
   * they cannot. It is a status the guide reports, not a step it assigns.
   */
  shopApproved!: boolean;
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
