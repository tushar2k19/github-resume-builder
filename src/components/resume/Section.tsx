import type { ReactNode } from 'react';
import { RevealGroup, RevealItem } from '../../ui/motion';

/** One sheet section: a short 1px green rule, a muted kicker, the title, then staggered content. */
export function Section({
  id,
  kicker,
  title,
  lead,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <RevealGroup as="section" id={id} className="scroll-mt-6">
      <RevealItem as="header" className="mb-5">
        <div aria-hidden="true" className="mb-3 h-px w-full" style={{ background: 'rgba(255,248,240,0.08)' }}>
          <div className="h-px w-10 bg-glow" />
        </div>
        <p className="num m-0 text-[11px] uppercase tracking-[0.14em] text-muted">{kicker}</p>
        <h2 className="m-0 mt-1 text-[1.5rem] font-medium leading-tight tracking-[-0.01em] text-fg sm:text-[1.75rem]">{title}</h2>
        {lead && <p className="m-0 mt-1.5 max-w-[62ch] text-[14px] leading-relaxed text-muted">{lead}</p>}
      </RevealItem>
      {children}
    </RevealGroup>
  );
}
