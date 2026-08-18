import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth.options';
import { serverApi } from '../../../../lib/api-client';
import * as Handlebars from 'handlebars';

// ── Sample data per template slug ─────────────────────────────────────────────

const COMMON = {
  firstName:   'Jane',
  lastName:    'Doe',
  email:       'jane.doe@example.com',
  year:        new Date().getFullYear(),
  shopUrl:     'https://ezihubb.com',
  unsubscribeUrl: 'https://ezihubb.com/unsubscribe',
};

const ORDER_SAMPLE = {
  orderNumber:    'DD-2026-00042',
  orderUrl:       'https://ezihubb.com/account/orders/ord_example',
  orderDate:      'Jun 13, 2026',
  subtotal:       '74.98',
  discountAmount: '5.00',
  shippingCost:   '4.99',
  shippingMethod: 'USPS Priority',
  total:          '74.97',
  shippingName:   'Jane Doe',
  shippingAddress:'123 Maple Street',
  shippingCity:   'Brooklyn, NY 11201',
  shippingCountry:'US',
  items: [
    { productName: 'Custom Pet Portrait Pillow', quantity: 1, unitPrice: '49.99' },
    { productName: 'Personalized Family Mug',     quantity: 1, unitPrice: '24.99' },
  ],
};

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  'order-confirmation': {
    ...COMMON,
    ...ORDER_SAMPLE,
  },
  'order-shipped': {
    ...COMMON,
    ...ORDER_SAMPLE,
    carrier:        'USPS',
    trackingNumber: '9400111899223450236713',
    trackingUrl:    'https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400111899223450236713',
    estimatedDelivery: 'Jun 18–20, 2026',
  },
  'order-delivered': {
    ...COMMON,
    ...ORDER_SAMPLE,
    reviewUrl: 'https://ezihubb.com/account/orders/ord_example/review',
  },
  'review-reminder': {
    ...COMMON,
    ...ORDER_SAMPLE,
    productName: 'Custom Pet Portrait Pillow',
    reviewUrl:   'https://ezihubb.com/account/orders/ord_example/review',
  },
  'reset-password': {
    ...COMMON,
    resetUrl:  'https://ezihubb.com/reset-password?token=example_token_abc123',
    expiresIn: '1 hour',
  },
  'email-verify': {
    ...COMMON,
    verifyUrl: 'https://ezihubb.com/verify-email?token=example_verify_abc123',
  },
  'welcome': {
    ...COMMON,
  },
  'refund-notification': {
    ...COMMON,
    ...ORDER_SAMPLE,
    refundAmount: '49.99',
    currency:     'USD',
    refundReason: 'Item not as described',
    refundMethod: 'Original payment method',
    refundNote:   'Please allow 5–10 business days for the refund to appear.',
  },
  'abandoned-cart': {
    ...COMMON,
    cartUrl: 'https://ezihubb.com/cart?token=example',
    items: [
      { productName: 'Custom Pet Portrait Pillow', quantity: 1, unitPrice: '49.99', imageUrl: '' },
    ],
  },
  'gift-card-delivery': {
    ...COMMON,
    recipientName:  'Alex Smith',
    senderName:     'Jane Doe',
    giftCardCode:   'GIFT-ABCD-EFGH-1234',
    giftCardAmount: '50.00',
    message:        'Happy Birthday! Enjoy shopping at EziHubb!',
    redeemUrl:      'https://ezihubb.com/gift-cards/redeem',
    expiresAt:      'Jun 13, 2027',
  },
  'new-message': {
    ...COMMON,
    senderName:  'EziHubb Support',
    messageBody: 'Hi Jane, your custom order is ready for production. Please confirm the personalization details.',
    inboxUrl:    'https://ezihubb.com/account/messages',
  },
  'new-store-order': {
    ...COMMON,
    storeName:   'Jane\'s Crafts',
    ...ORDER_SAMPLE,
    storeOrderUrl: 'https://ezihubb.com/sellers/orders/ord_example',
  },
  'payout-processed': {
    ...COMMON,
    storeName:     'Jane\'s Crafts',
    payoutAmount:  '245.00',
    payoutMethod:  'Bank Transfer',
    payoutDate:    'Jun 13, 2026',
    dashboardUrl:  'https://ezihubb.com/sellers/payouts',
  },
  'store-approved': {
    ...COMMON,
    storeName:   'Jane\'s Crafts',
    storeUrl:    'https://ezihubb.com/shops/janes-crafts',
    dashboardUrl:'https://ezihubb.com/sellers/dashboard',
  },
  'store-rejected': {
    ...COMMON,
    storeName:   'Jane\'s Crafts',
    reason:      'Your store application does not meet our quality guidelines at this time.',
    reapplyUrl:  'https://ezihubb.com/sellers/apply',
  },
  'store-suspended': {
    ...COMMON,
    storeName:   'Jane\'s Crafts',
    reason:      'Multiple policy violations detected.',
    appealUrl:   'https://ezihubb.com/sellers/appeal',
  },
  'affiliate-approved': {
    ...COMMON,
    commissionRate: '10',
    dashboardUrl:   'https://ezihubb.com/affiliates/dashboard',
    referralLink:   'https://ezihubb.com?ref=JANE2026',
  },
  'affiliate-rejected': {
    ...COMMON,
    reason: 'Your application does not meet our current affiliate program requirements.',
  },
  'commission-confirmed': {
    ...COMMON,
    orderNumber:      ORDER_SAMPLE.orderNumber,
    commissionAmount: '4.99',
    totalEarned:      '142.50',
    dashboardUrl:     'https://ezihubb.com/affiliates/dashboard',
  },
  'team-invite': {
    ...COMMON,
    inviterName: 'Super Admin',
    role:        'Manager',
    acceptUrl:   'https://admin.ezihubb.com/invite/accept?token=example',
    expiresIn:   '7 days',
  },
  'low-stock-alert': {
    ...COMMON,
    productName: 'Custom Pet Portrait Pillow',
    productSku:  'PET-PIL-001',
    quantity:    3,
    threshold:   5,
    editUrl:     'https://admin.ezihubb.com/products/prod_example',
  },
  'new-store-application': {
    ...COMMON,
    storeName:      'Jane\'s Crafts',
    applicantEmail: COMMON.email,
    reviewUrl:      'https://admin.ezihubb.com/stores?status=PENDING',
  },
  'store-application-received': {
    ...COMMON,
    storeName: 'Jane\'s Crafts',
  },
  'application-received': {
    ...COMMON,
    storeName: 'Jane\'s Crafts',
  },
  'content-flagged': {
    ...COMMON,
    contentType: 'Review',
    contentId:   'rev_example_123',
    reason:      'Spam or misleading content',
    reviewUrl:   'https://admin.ezihubb.com/moderation/queue',
  },
  'content-warning': {
    ...COMMON,
    contentType: 'Review',
    warningCount: 1,
    warningReason: 'Your review contained language that violated our community guidelines.',
    appealUrl:   'https://ezihubb.com/account/appeal',
  },
  'contact-message': {
    ...COMMON,
    subject:     'Question about custom order',
    messageBody: 'Hi, I would like to know if you can make a custom order with a photo of my dog.',
    replyUrl:    'https://admin.ezihubb.com/messages',
  },
};

// ── Fallback sample data for any unknown slug ─────────────────────────────────

function getSampleData(slug: string): Record<string, unknown> {
  return SAMPLE_DATA[slug] ?? {
    ...COMMON,
    ...ORDER_SAMPLE,
    message:     'This is a sample message for preview purposes.',
    actionUrl:   'https://ezihubb.com',
    actionLabel: 'Visit EziHubb',
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // Auth guard — SUPER_ADMIN only. Previously only checked "is there a
  // session," which let any shop-owner ADMIN preview platform-wide email
  // templates too — matches the backend's AdminEmailTemplatesController,
  // which now enforces the same restriction (@Roles(Role.SUPER_ADMIN)).
  const session = await getServerSession(authOptions);
  const role = (session?.user as Record<string, unknown> | undefined)?.['role'] as string | undefined;
  if (!session || role !== 'SUPER_ADMIN') {
    return new NextResponse('<h1>Unauthorized</h1>', {
      status: 401,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const { slug } = await params;

  // Fetch template body from NestJS API via serverApi (handles auth)
  let body: string;
  try {
    const tpl = await serverApi<{ slug: string; name: string; body: string }>('get', `/admin/email-templates/${slug}`);
    body = tpl.body ?? '';
  } catch {
    return new NextResponse(`<h1>Template "${slug}" not found</h1>`, {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!body || body.includes('<!-- Template')) {
    return new NextResponse(`<h1>Template "${slug}" has no content yet</h1>`, {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Compile + render with sample data
  let html: string;
  try {
    const template = Handlebars.compile(body);
    html = template(getSampleData(slug));
  } catch (e) {
    html = `<pre style="color:red">Handlebars error: ${String(e)}</pre>\n\n${body}`;
  }

  // Inject a preview banner at the top
  const banner = `
<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1E1E2E;color:#fff;
  font-family:system-ui,sans-serif;font-size:13px;padding:8px 20px;
  display:flex;align-items:center;justify-between;gap:12px;border-bottom:2px solid #6366F1;">
  <span>📧 <strong>Email Preview</strong> — <code style="background:#fff1;padding:2px 6px;border-radius:4px">${slug}</code> (sample data)</span>
  <button onclick="window.close()" style="background:#6366F1;color:#fff;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">✕ Close</button>
</div>
<div style="height:40px"></div>`;

  const finalHtml = html.replace(/<body([^>]*)>/, `<body$1>${banner}`);

  return new NextResponse(finalHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
