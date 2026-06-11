'use client';

import { ScanSearch } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { IPScanPanel } from '../../../../components/moderation/IPScanPanel';

export default function IPScanPage() {
  return (
    <>
      <AdminPageHeader
        title="IP Scanner"
        subtitle="Manually scan images for intellectual property and trademark violations"
        queryKey={['admin-ip-scan']}
      />
      <div className="max-w-2xl">
        <IPScanPanel />
      </div>
    </>
  );
}
