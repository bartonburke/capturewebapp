'use client';

import { ReactNode } from 'react';

interface HorizontalScrollRowProps {
  title: string;
  children: ReactNode;
}

export default function HorizontalScrollRow({ title, children }: HorizontalScrollRowProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-white mb-3 px-4">{title}</h2>
      <div
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 pb-2 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
