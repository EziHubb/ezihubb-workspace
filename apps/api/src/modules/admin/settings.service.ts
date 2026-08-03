import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { QUEUES, JOBS, SendEmailJobData } from '../../queue/queue.constants';

const SETTINGS_TTL = 300; // 5 minutes

const DEFAULTS: Record<string, Record<string, unknown>> = {
  store: {
    name: 'EziHubb',
    description: '',
    contactEmail: '',
    supportPhone: '',
    logoUrl: '',
    faviconUrl: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    currency: 'USD',
    taxRate: 0,
    taxIncluded: false,
  },
  email: {
    host: '',
    port: '587',
    user: '',
    password: '',
    fromName: 'EziHubb',
    fromEmail: '',
  },
  notifications: {
    newOrder: true,
    orderNeedsAction: true,
    newReview: true,
    dailySummary: false,
    dailySummaryTime: '08:00',
    slackWebhook: '',
  },
  seo: {
    gaId: '',
    googleVerification: '',
    metaPixelId: '',
  },
  theme: {
    primaryRgb:   '232 93 63',
    primaryDark:  '#C44A2E',
    primaryLight: '#FFF0EC',
  },
};

const TEMPLATE_NAMES: Record<string, string> = {
  'order-confirmation':  'Order Confirmation',
  'order-shipped':       'Order Shipped',
  'order-delivered':     'Order Delivered',
  'review-reminder':     'Review Reminder',
  'reset-password':      'Password Reset',
  'welcome':             'Welcome',
  'refund-notification': 'Refund Notification',
  'gift-card-delivery':  'Gift Card Delivery',
  'abandoned-cart':      'Abandoned Cart',
  'team-invite':         'Team Invite',
  'low-stock-alert':     'Low Stock Alert',
  'commission-confirmed':'Commission Confirmed',
  'payout-processed':    'Payout Processed',
  'loyalty-points-earned':'Loyalty Points Earned',
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async getSettings(key: string): Promise<Record<string, unknown>> {
    const cacheKey = `settings:${key}`;
    const cached = await this.redis.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const row = await this.prisma.appSettings.findUnique({ where: { key } });
    const value = row
      ? ({ ...(DEFAULTS[key] ?? {}), ...(row.value as Record<string, unknown>) })
      : (DEFAULTS[key] ?? {});

    await this.redis.set(cacheKey, value, SETTINGS_TTL);
    return value;
  }

  async updateSettings(key: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const current = await this.getSettings(key);
    const merged = { ...current, ...patch };

    await this.prisma.appSettings.upsert({
      where:  { key },
      create: { key, value: merged as Prisma.InputJsonValue },
      update: { value: merged as Prisma.InputJsonValue },
    });

    await this.redis.del(`settings:${key}`);
    return merged;
  }

  async sendTestEmail(to: string): Promise<void> {
    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to,
      subject: 'Test Email from EziHubb',
      template: 'welcome',
      data: { firstName: 'Admin' },
    } satisfies SendEmailJobData);
  }

  async flushSettingsCache(): Promise<void> {
    await this.redis.invalidatePattern('settings:*');
  }

  // ── Email Templates ──────────────────────────────────────────────────────────

  async listEmailTemplates(): Promise<{ slug: string; name: string; updatedAt: string }[]> {
    const templatesDir = path.join(__dirname, 'assets', 'email-templates');

    let fileSlugs: string[] = [];
    if (fs.existsSync(templatesDir)) {
      fileSlugs = fs
        .readdirSync(templatesDir)
        .filter((f) => f.endsWith('.hbs'))
        .map((f) => f.replace('.hbs', ''));
    } else {
      fileSlugs = Object.keys(TEMPLATE_NAMES);
    }

    const overrides = await this.prisma.emailTemplateOverride.findMany({
      where: { slug: { in: fileSlugs } },
      select: { slug: true, updatedAt: true },
    });
    const overrideMap = new Map<string, string>(overrides.map((o) => [o.slug, o.updatedAt.toISOString()]));

    return fileSlugs.map((slug) => ({
      slug,
      name: TEMPLATE_NAMES[slug] ?? slug,
      updatedAt: overrideMap.get(slug) ?? new Date().toISOString(),
    }));
  }

  async getEmailTemplate(slug: string): Promise<{ slug: string; name: string; body: string; updatedAt: string }> {
    const override = await this.prisma.emailTemplateOverride.findUnique({ where: { slug } });
    if (override) {
      return {
        slug,
        name: TEMPLATE_NAMES[slug] ?? slug,
        body: override.body,
        updatedAt: override.updatedAt.toISOString(),
      };
    }

    const templatePath = path.join(__dirname, 'assets', 'email-templates', `${slug}.hbs`);
    const body = fs.existsSync(templatePath)
      ? fs.readFileSync(templatePath, 'utf8')
      : `<!-- Template "${slug}" not found -->`;

    return {
      slug,
      name: TEMPLATE_NAMES[slug] ?? slug,
      body,
      updatedAt: new Date().toISOString(),
    };
  }

  async updateEmailTemplate(slug: string, body: string): Promise<{ slug: string; updatedAt: string }> {
    const record = await this.prisma.emailTemplateOverride.upsert({
      where:  { slug },
      create: { slug, body },
      update: { body },
    });
    return { slug, updatedAt: record.updatedAt.toISOString() };
  }
}
