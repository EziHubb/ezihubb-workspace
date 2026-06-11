import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const });
  }

  // ── Public: get store membership ─────────────────────────────────────────

  async getStoreMembership(storeSlug: string) {
    const store = await this.prisma.store.findUnique({
      where:   { slug: storeSlug },
      include: { memberships: { where: { isActive: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store.memberships[0] ?? null;
  }

  // ── Public: check if user is a fan ───────────────────────────────────────

  async isFan(userId: string, storeId: string): Promise<boolean> {
    const sub = await this.prisma.storeMembershipSubscription.findFirst({
      where: { userId, storeId, status: 'ACTIVE' },
    });
    return !!sub;
  }

  // ── Subscribe to fan membership (Stripe) ─────────────────────────────────

  async subscribe(userId: string, membershipId: string): Promise<{ subscriptionId: string; clientSecret: string | null }> {
    const membership = await this.prisma.storeMembership.findUnique({
      where:   { id: membershipId },
      include: { store: true },
    });
    if (!membership || !membership.isActive) throw new NotFoundException('Membership not found');

    // Prevent duplicate
    const existing = await this.prisma.storeMembershipSubscription.findFirst({
      where: { userId, storeId: membership.storeId, status: 'ACTIVE' },
    });
    if (existing) throw new BadRequestException('Already subscribed');

    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { email: true, firstName: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Get or create Stripe customer
    let stripeCustomerId: string;
    const existingCustomers = await this.stripe.customers.list({ email: user.email, limit: 1 });
    if (existingCustomers.data.length > 0) {
      stripeCustomerId = existingCustomers.data[0].id;
    } else {
      const customer = await this.stripe.customers.create({ email: user.email, name: user.firstName ?? undefined });
      stripeCustomerId = customer.id;
    }

    // Create Stripe price
    const price = await this.stripe.prices.create({
      unit_amount:    Math.round(Number(membership.price) * 100),
      currency:       'usd',
      recurring:      { interval: 'month' },
      product_data:   { name: `${membership.store.name} — ${membership.name}` },
    });

    // Create subscription (no payment method yet — requires SetupIntent or PaymentMethod)
    const subscription = await this.stripe.subscriptions.create({
      customer:          stripeCustomerId,
      items:             [{ price: price.id }],
      payment_behavior:  'default_incomplete',
      payment_settings:  { save_default_payment_method: 'on_subscription' },
      expand:            ['latest_invoice.payment_intent'],
      metadata:          { userId, membershipId, storeId: membership.storeId },
    });

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = invoice?.payment_intent as any | null;

    // Create subscription record (ACTIVE set by webhook)
    await this.prisma.storeMembershipSubscription.create({
      data: {
        userId,
        storeId:              membership.storeId,
        membershipId,
        status:               'ACTIVE',
        stripeSubscriptionId: subscription.id,
        stripeCustomerId,
        currentPeriodEnd:     new Date(subscription.current_period_end * 1000),
      },
    });

    return {
      subscriptionId: subscription.id,
      clientSecret:   paymentIntent?.client_secret ?? null,
    };
  }

  // ── Cancel membership ─────────────────────────────────────────────────────

  async cancel(userId: string, storeId: string): Promise<void> {
    const sub = await this.prisma.storeMembershipSubscription.findFirst({
      where: { userId, storeId, status: 'ACTIVE' },
    });
    if (!sub) throw new NotFoundException('No active subscription');

    await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);

    await this.prisma.storeMembershipSubscription.update({
      where: { id: sub.id },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // Update member count
    await this.prisma.storeMembership.update({
      where: { id: sub.membershipId },
      data:  { subscriberCount: { decrement: 1 } },
    });
  }

  // ── Stripe webhook handlers ───────────────────────────────────────────────

  async handleSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    const sub = await this.prisma.storeMembershipSubscription.findFirst({
      where: { stripeSubscriptionId },
    });
    if (!sub) return;
    await this.prisma.storeMembershipSubscription.update({
      where: { id: sub.id },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.prisma.storeMembership.update({
      where: { id: sub.membershipId },
      data:  { subscriberCount: { decrement: 1 } },
    }).catch(() => {});
  }

  async handleSubscriptionUpdated(stripeSubscriptionId: string, currentPeriodEnd: number): Promise<void> {
    await this.prisma.storeMembershipSubscription.updateMany({
      where: { stripeSubscriptionId },
      data:  { currentPeriodEnd: new Date(currentPeriodEnd * 1000) },
    });
  }

  // ── Seller: manage membership ─────────────────────────────────────────────

  async createMembership(storeId: string, dto: {
    name: string; description: string; price: number; perks: string[];
  }) {
    const existing = await this.prisma.storeMembership.findFirst({ where: { storeId, isActive: true } });
    if (existing) throw new BadRequestException('Store already has an active membership');

    return this.prisma.storeMembership.create({
      data: { storeId, name: dto.name, description: dto.description, price: dto.price, perks: dto.perks },
    });
  }

  async updateMembership(membershipId: string, storeId: string, dto: Partial<{
    name: string; description: string; price: number; perks: string[]; isActive: boolean;
  }>) {
    const membership = await this.prisma.storeMembership.findFirst({ where: { id: membershipId, storeId } });
    if (!membership) throw new NotFoundException('Membership not found');
    return this.prisma.storeMembership.update({ where: { id: membershipId }, data: dto });
  }

  async getMembershipStats(storeId: string) {
    const membership = await this.prisma.storeMembership.findFirst({
      where: { storeId, isActive: true },
      select: { id: true, name: true, price: true, subscriberCount: true, mrr: true },
    });
    return membership;
  }
}
