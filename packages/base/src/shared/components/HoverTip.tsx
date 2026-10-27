import { ChevronRightIcon } from 'lucide-react';
import React, { ReactNode } from 'react';

import { Button } from './Button';
import {
  Collapsible,
  CollapsibleContentAnimated,
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
  ...contentProps
}: IHoverTipProps) {
  return (
    <HoverCard>
      <HoverCardTrigger
        aria-label={triggerLabel}
        className="m-0 inline-flex cursor-help items-center border-0 bg-transparent p-0 leading-none text-foreground"
        closeDelay={closeDelay}
        delay={openDelay}
      >
        {icon}
      </HoverCardTrigger>
      <HoverCardContent
        className={cn(
          'flex flex-col [&_a]:text-primary [&_a]:underline',
          className,
        )}
        {...contentProps}
      >
        {text}
        {children && (
          <Collapsible
            render={<div className="flex flex-col self-start pt-2" />}
          >
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-auto justify-start pl-0 text-muted-foreground hover:bg-transparent hover:text-foreground data-panel-open:bg-transparent data-panel-open:hover:bg-transparent"
                />
              }
            >
              <ChevronRightIcon className="transition-transform group-data-panel-open/button:rotate-90" />
              More Info
            </CollapsibleTrigger>
            <CollapsibleContentAnimated>{children}</CollapsibleContentAnimated>
          </Collapsible>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
