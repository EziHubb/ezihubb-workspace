import { http, HttpResponse } from 'msw';

const BASE = (
  process.env['API_URL'] ??
  process.env['NEXT_PUBLIC_API_URL'] ??
  'http://localhost:3002'
).replace(/\/api\/v1\/?$/, '').replace(/\/$/, '') + '/api/v1';

export const storeHandlers = [
  http.get(`${BASE}/admin/stores`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'store-1',
          name: 'Test Shop',
          slug: 'test-shop',
          status: 'PENDING',
          planType: 'COMMISSION',
          commissionRate: 0.12,
          totalOrders: 12,
          totalRevenue: 1500,
          owner: { email: 'seller@test.com', firstName: 'Jane', lastName: 'Doe' },
          _count: { products: 5, orders: 12 },
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
    }),
  ),

  http.post(`${BASE}/admin/stores/:id/approve`, () =>
    HttpResponse.json({ success: true, data: { status: 'ACTIVE' } }),
  ),

  http.post(`${BASE}/admin/stores/:id/reject`, () =>
    HttpResponse.json({ success: true, data: { status: 'REJECTED' } }),
  ),

  http.post(`${BASE}/admin/stores/:id/suspend`, () =>
    HttpResponse.json({ success: true, data: { status: 'SUSPENDED' } }),
  ),
];

export const moderationHandlers = [
  http.get(`${BASE}/admin/moderation/flags`, () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          id: 'flag-1',
          type: 'PRODUCT',
          severity: 'HIGH',
          status: 'PENDING',
          reason: 'Test reasoning for AI moderation',
          aiScore: 0.94,
          aiLabel: 'adult_content',
          targetId: 'prod-1',
          targetName: 'Flagged Product Name',
          targetUrl: null,
          reportedBy: null,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedBy: null,
        },
      ],
      pagination: { total: 1, page: 1, limit: 25, totalPages: 1 },
    }),
  ),

  http.get(`${BASE}/admin/moderation/stats`, () =>
    HttpResponse.json({
      success: true,
      data: {
        totalPending: 1,
        criticalCount: 1,
        totalToday: 3,
        avgResolutionHours: 2.5,
      },
    }),
  ),

  http.post(`${BASE}/admin/moderation/flags/:id/approve`, () =>
    HttpResponse.json({ success: true, data: { status: 'APPROVED' } }),
  ),

  http.post(`${BASE}/admin/moderation/flags/:id/reject`, () =>
    HttpResponse.json({ success: true, data: { status: 'REJECTED' } }),
  ),

  http.post(`${BASE}/admin/moderation/flags/:id/escalate`, () =>
    HttpResponse.json({ success: true, data: { status: 'ESCALATED' } }),
  ),
];
