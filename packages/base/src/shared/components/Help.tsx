import { Info } from 'lucide-react';
import React, { ReactNode } from 'react';
import { HoverCardTrigger, HoverCardContent, HoverCard } from './HoverCard';

interface HelpProps {
  children: ReactNode;
  openDelay?: number;
  closeDelay?: number;
  portalContainerRef?: React.RefObject<HTMLElement | null>;
}

export function Help({
  children,
  openDelay = 100,
  closeDelay = 100,
  portalContainerRef,
}: HelpProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger>
        <Info className="jgis-inline-icon" />
      </HoverCardTrigger>
      <HoverCardContent portalContainerRef={portalContainerRef}>
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}
