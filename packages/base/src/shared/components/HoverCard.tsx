import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from './utils';

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({
  className,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      className={cn('jgis-hover-card-trigger', className)}
      {...props}
    />
  );
}

interface IHoverCardContentProps extends React.ComponentProps<
  typeof HoverCardPrimitive.Content
> {
  portalContainerRef?: React.RefObject<HTMLElement | null>;
}

function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  portalContainerRef,
  ...props
}: IHoverCardContentProps) {
  const portalContainer =
    portalContainerRef?.current ?? document.querySelector('#main');

  return (
    <HoverCardPrimitive.Portal
      data-slot="hover-card-portal"
      container={portalContainer ?? undefined}
    >
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn('jgis-hover-card-content', className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
