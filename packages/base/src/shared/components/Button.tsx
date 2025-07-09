import { Slot } from '@radix-ui/react-slot';
import * as React from 'react';

import { cn } from './utils';

interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'icon';
  size?: 'sm' | 'lg' | 'icon' | 'icon-sm';
}

const Button = React.forwardRef<HTMLButtonElement, IButtonProps>(
  ({ variant, className, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        data-size={size}
        data-variant={variant}
        className={cn('jgis-button', className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
export type { IButtonProps as ButtonProps };
