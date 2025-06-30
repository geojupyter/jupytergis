import * as React from 'react';

interface IBadgeProps extends React.HTMLAttributes<HTMLButtonElement> {
  variant?: 'destructive' | 'outline' | 'secondary';
  size?: 'sm' | 'lg' | 'icon';
}

function Badge({ variant, ...props }: IBadgeProps) {
  return (
    // @ts-expect-error lol
    <div data-variant={variant} className={'jgis-badge'} {...props} />
  );
}

export default Badge;
