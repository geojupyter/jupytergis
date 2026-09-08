import React from 'react';

import { Button } from '@/src/shared/components/Button';
import { cn } from '@/src/shared/components/utils';

export interface IListStoryTitleBarSegmentButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
  'aria-label'?: string;
}

export function ListStoryTitleBarSegmentButton({
  label,
  isActive,
  onClick,
  className,
  'aria-label': ariaLabel,
}: IListStoryTitleBarSegmentButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn('jgis-underline-indicator w-fit', className)}
      data-active={isActive ? true : undefined}
      aria-current={isActive ? 'true' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
