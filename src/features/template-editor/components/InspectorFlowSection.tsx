"use client";

import type { ReactNode } from 'react';

interface InspectorFlowSectionProps {
  title: string;
  children: ReactNode;
}

export function InspectorFlowSection({ title, children }: InspectorFlowSectionProps) {
  return (
    <section className="space-y-2 border-t border-[#202631] pt-3 first:border-t-0 first:pt-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
