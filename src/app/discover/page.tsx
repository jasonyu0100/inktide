'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DiscoverPage } from '@/components/discover/DiscoverPage';

function DiscoverInner() {
  const params = useSearchParams();
  const inquiryId = params.get('id') ?? undefined;
  return <DiscoverPage inquiryId={inquiryId} />;
}

export default function Page() {
  return (
    <Suspense>
      <DiscoverInner />
    </Suspense>
  );
}
