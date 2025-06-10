import { VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './utils';

const buttonVariants = cva('jgis-button-shared', {
  variants: {
    variant: {
      default: 'jgis-button-variant-default',
      destructive: 'jgis-button-variant-destructive',
      outline: 'jgis-button-variant-outline',
      secondary: 'jgis-button-variant-secondary',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'underline-offset-4 hover:underline text-primary',
      bubble: 'jgis-button-variant-bubble'
    },
    size: {
      default: 'jgis-button-size-default',
      sm: 'jgis-button-size-sm',
      lg: 'h-11 px-8 rounded-md'
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'default'
  }
});

export interface IButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, IButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
