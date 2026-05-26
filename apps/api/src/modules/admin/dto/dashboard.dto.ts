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
