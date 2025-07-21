import * as React from 'react';

import { cn } from './utils';

interface IBadgeProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant?: 'destructive' | 'outline' | 'secondary';
  size?: 'sm' | 'lg' | 'icon';
}

function Badge({ variant, className, ...props }: IBadgeProps) {
  return (
    // @ts-expect-error lol
    <div
      data-variant={variant}
      className={cn('jgis-badge', className)}
      {...props}
    />
  );
}

export default Badge;
