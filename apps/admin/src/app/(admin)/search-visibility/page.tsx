'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { ReloadButton } from '../../../components/ui/ReloadButton';

interface ShopHealth {
  checklist: { shopName: boolean; logo: boolean; banner: boolean; story: boolean; sellerPhoto: boolean };
  listingsNeedingTitleWork: number;
  performanceScore: number | null;
  topTasks: { overdueOrders: number; ordersToSendToday: number; helpRequests: number; soldOutListings: number; inactiveListings: number };
}

const TIPS = [
  { title: 'The Ultimate Guide to Search', desc: 'Get an inside look at how search works and learn strategies to optimise your shop and listings.' },
  { title: 'Keywords 101: Everything You Need to Know', desc: "Follow these dos and don'ts when adding tags, and brainstorm new keywords with tried-and-true techniques." },
  { title: "Add Attributes to Help Increase Your Shop's Visibility", desc: 'Learn how listing attributes are an important factor in helping items appear in relevant searches.' },
];

export default function SearchVisibilityPage() {
  const { data, isLoading } = useQuery<ShopHealth>({
    queryKey: ['shop-health'],
    queryFn:  () => api.get<ShopHealth>(API_ROUTES.ADMIN.DASHBOARD_SHOP_HEALTH),
  });

  const checklistDone = data ? Object.values(data.checklist).filter(Boolean).length : 0;
  const checklistTotal = 5;
  const shopComplete = checklistDone === checklistTotal;
  const hasTitleIssues = (data?.listingsNeedingTitleWork ?? 0) > 0;
  const serviceOk = (data?.performanceScore ?? 0) >= 70;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-secondary">Search visibility</h1>
        <ReloadButton queryKey={['shop-health']} />
      </div>

      {isLoading || !data ? (
        <div className="h-40 bg-surface rounded-card border border-border animate-pulse" />
      ) : (
        <>
          {(hasTitleIssues || !shopComplete) && (
            <div className="mb-8">
              <div className="mb-3">
                <h2 className="font-display text-lg font-bold text-secondary">
                  {(hasTitleIssues ? 1 : 0) + (shopComplete ? 0 : 1)} factor{(hasTitleIssues ? 1 : 0) + (shopComplete ? 0 : 1) !== 1 ? 's' : ''} risk{(hasTitleIssues ? 1 : 0) + (shopComplete ? 0 : 1) === 1 ? 's' : ''} lowering your search visibility
                </h2>
                <p className="text-sm text-muted mt-0.5">Improving photos, listing info, and more can help how you show up in search.</p>
              </div>
              <div className="space-y-3">
                {hasTitleIssues && (
                  <div className="bg-surface border border-border rounded-card p-5 flex items-start gap-4">
                    <span className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-secondary">Your listings</p>
                      <p className="text-xs text-muted mt-0.5 mb-3">Some of your listings could use a refresh to unlock their full potential.</p>
                      <div className="border border-border rounded-lg px-4 py-3.5">
                        <p className="text-sm font-semibold text-secondary">Make your titles even clearer to buyers</p>
                        <p className="text-xs text-muted mt-1 mb-3">
                          {data.listingsNeedingTitleWork} listing{data.listingsNeedingTitleWork !== 1 ? 's have' : ' has'} a title that's likely too short to
                          help buyers understand what you're selling.
                        </p>
                        <Link href="/products" className="inline-flex items-center gap-1 text-sm font-bold text-secondary border border-border rounded-pill px-4 py-2 hover:border-secondary/40 transition-colors">
                          Update titles
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
                {!shopComplete && (
                  <div className="bg-surface border border-border rounded-card p-5 flex items-start gap-4">
                    <span className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-secondary">Your shop</p>
                      <p className="text-xs text-muted mt-0.5 mb-3">A complete shop profile helps build trust with buyers and can improve how you show up in search.</p>
                      <div className="border border-border rounded-lg px-4 py-3.5">
                        <p className="text-sm font-semibold text-secondary">Finish setting up your shop</p>
                        <p className="text-xs text-muted mt-1 mb-3">{checklistDone}/{checklistTotal} complete.</p>
                        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold text-secondary border border-border rounded-pill px-4 py-2 hover:border-secondary/40 transition-colors">
                          Finish your shop profile
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(shopComplete || serviceOk) && (
            <div className="mb-8">
              <h2 className="font-display text-lg font-bold text-secondary mb-3">Here&apos;s where you&apos;re right on track</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shopComplete && (
                  <div className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-secondary">Your shop</p>
                      <p className="text-xs text-muted mt-0.5">Awesome work! Your shop info helps build trust with buyers.</p>
                    </div>
                  </div>
                )}
                {serviceOk && (
                  <div className="bg-surface border border-border rounded-card p-4 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-secondary">Service standards</p>
                      <p className="text-xs text-muted mt-0.5">
                        Based on your response rate, dispatch rate, and reviews.{' '}
                        <Link href="/customer-service-stats" className="font-semibold text-secondary underline underline-offset-2 inline-flex items-center gap-0.5">
                          View progress <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-display text-lg font-bold text-secondary mb-1">Bonus tips to help boost your visibility</h2>
            <p className="text-sm text-muted mb-4">Looking for extra ways to improve your search visibility? Here are tips to make your shop truly shine.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TIPS.map((t) => (
                <div key={t.title} className="bg-surface border border-border rounded-card p-4">
                  <h4 className="text-sm font-bold text-secondary mb-1.5">{t.title}</h4>
                  <p className="text-xs text-muted leading-relaxed mb-3">{t.desc}</p>
                  <span className="text-xs font-bold text-secondary">Get tips →</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
