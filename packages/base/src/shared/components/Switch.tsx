import { Switch as SwitchPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from './utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn('jgis-switch', className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="jgis-switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
