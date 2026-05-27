"use client";

import type { ReactNode } from 'react';

interface InspectorFlowSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function InspectorFlowSection({ title, description, children }: InspectorFlowSectionProps) {
  return (
    <section className="space-y-2 border-t border-[#202631] pt-3 first:border-t-0 first:pt-0">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f95a3]">{title}</div>
        {description ? (
          <p className="mt-1 text-[10px] leading-4 text-[#6f7785]">{description}</p>
        ) : null}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
