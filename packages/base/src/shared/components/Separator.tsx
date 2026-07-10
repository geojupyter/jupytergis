import { Separator as SeparatorPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from './utils';

function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn('jgis-separator', className)}
      {...props}
    />
  );
}

export { Separator };
