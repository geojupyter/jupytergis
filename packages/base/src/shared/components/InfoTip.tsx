import { ChevronRightIcon, Info } from 'lucide-react';
import React, { ReactNode } from 'react';
import {
  HoverCardTrigger,
  HoverCardContent,
  HoverCard,
} from './HoverCard';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './Collapsible';
import { Button } from './Button';
import { cn } from './utils';

interface InfoTipProps
  extends Omit<React.ComponentProps<typeof HoverCardContent>, 'children'> {
  text: string;
  openDelay?: number;
  closeDelay?: number;
  children?: ReactNode;
}

export function InfoTip({
  children,
  text,
  openDelay = 100,
  closeDelay = 100,
  className,
  portalContainerRef,
  ...contentProps
}: InfoTipProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger aria-label="More information">
        <Info data-size="md" />
      </HoverCardTrigger>
      <HoverCardContent
        portalContainerRef={portalContainerRef}
        className={cn('jgis-info-tip-content', className)}
        {...contentProps}
      >
        {text}
        {children && (
          <Collapsible asChild>
            <div className="jgis-info-tip-collapsible">
              <CollapsibleTrigger asChild>
                <div className="jgis-info-tip-collapsible-trigger">
                  <Button
                    size="icon-sm"
                    variant="icon"
                    className="jgis-rotate-90 jgis-bg-transparent"
                  >
                    <ChevronRightIcon data-icon="inline-start" />
                  </Button>
                  <span className="jgis-info-tip-more-info">More Info</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="jgis-info-tip-collapsible-content">
                {children}
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
