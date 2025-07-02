import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from './utils';

const Popover: React.FC<React.ComponentProps<typeof PopoverPrimitive.Root>> = ({
  ...props
}) => {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
};

const PopoverTrigger: React.FC<
  React.ComponentProps<typeof PopoverPrimitive.Trigger>
> = ({ ...props }) => {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
};

const PopoverContent: React.FC<
  React.ComponentProps<typeof PopoverPrimitive.Content>
> = ({ className, align = 'center', sideOffset = 4, ...props }) => {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn('PopoverContent', className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
};

const PopoverAnchor: React.FC<
  React.ComponentProps<typeof PopoverPrimitive.Anchor>
> = ({ ...props }) => {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
};

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
