'use client';

import { BarChart2 } from 'lucide-react';

export default function SellerAnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">Analytics</h1>
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-dashed border-border rounded-card">
        <BarChart2 className="w-14 h-14 text-muted/30" />
        <p className="font-semibold text-secondary">Analytics Coming Soon</p>
        <p className="text-sm text-muted max-w-sm">
          Detailed charts for views, conversion, revenue over time, and top products will be available here.
        </p>
      </div>
    </div>
  );
}
