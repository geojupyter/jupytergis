import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { ButtonTw } from './ButtonTw';
import { cn } from './utils';

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel data-slot="collapsible-content" {...props} />
  );
}

function CollapsibleContentAnimated({
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      className={cn(
        'h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden=until-found])]:hidden',
        className,
      )}
      {...props}
    />
  );
}

interface ICollapsibleHeaderProps extends Omit<
  React.ComponentPropsWithoutRef<'div'>,
  'title'
> {
  title: React.ReactNode;
  titleId?: string;
  actions?: React.ReactNode;
}

/**
 * Shared collapsible trigger chrome: chevron + title, optional trailing actions.
 * Use as `CollapsibleTrigger` `render={<CollapsibleHeader … />}` (needs forwardRef).
 */
const CollapsibleHeader = React.forwardRef<
  HTMLDivElement,
  ICollapsibleHeaderProps
>(function CollapsibleHeader(
  { title, titleId, actions, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer items-center justify-between gap-1 px-1 text-sm font-bold hover:bg-muted data-panel-open:bg-secondary data-panel-open:hover:bg-secondary/60',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-1">
        <ButtonTw
          size="icon-xs"
          variant="ghost"
          className="jgis-rotate-90 hover:bg-transparent"
        >
          <ChevronRightIcon />
        </ButtonTw>
        <span id={titleId} className="truncate">
          {title}
        </span>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  );
});

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  CollapsibleContentAnimated,
  CollapsibleHeader,
};
