import { ChevronRightIcon } from 'lucide-react';
import React, { ReactNode } from 'react';

import { Button } from './Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './Collapsible';
import { HoverCardTrigger, HoverCardContent, HoverCard } from './HoverCard';
import { cn } from './utils';

export interface IHoverTipProps extends Omit<
  React.ComponentProps<typeof HoverCardContent>,
  'children'
> {
  /**
   * Icon rendered as the hover trigger.
   */
  icon: ReactNode;
  /**
   * Accessible label for the trigger.
   */
  triggerLabel: string;
  text: string;
  openDelay?: number;
  closeDelay?: number;
  children?: ReactNode;
}

/**
 * Shared hover-tip primitive: an icon trigger that reveals `text` (and optional
 * collapsible `children`) on hover. Not used directly — see `InfoTip` and
 * `ErrorTip` for the concrete variants.
 */
export function HoverTip({
  icon,
  triggerLabel,
  children,
  text,
  openDelay = 100,
  closeDelay = 100,
  className,
  portalContainerRef,
  ...contentProps
}: IHoverTipProps) {
  return (
    <HoverCard openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCardTrigger aria-label={triggerLabel}>{icon}</HoverCardTrigger>
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
