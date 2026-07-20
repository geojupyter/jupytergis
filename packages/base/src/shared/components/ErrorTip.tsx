import { XCircle } from 'lucide-react';
import React from 'react';

import { HoverTip, IHoverTipProps } from './HoverTip';
import { cn } from './utils';

interface IErrorTipProps extends Omit<IHoverTipProps, 'icon' | 'triggerLabel'> {
  /**
   * Accessible label for the trigger.
   *
   * @default 'Validation error'
   */
  triggerLabel?: string;
}

/**
 * A compact field-level error indicator: a `❌` icon that reveals the error
 * `text` on hover. Use next to a self-validating form field.
 *
 * For dialog- or panel-scoped messages use `ErrorBanner`; for app-global
 * messages use `Notification` from `@jupyterlab/apputils`.
 */
export function ErrorTip({
  triggerLabel = 'Validation error',
  className,
  ...props
}: IErrorTipProps) {
  return (
    <HoverTip
      icon={<XCircle data-size="md" className="jgis-error-tip-icon" />}
      triggerLabel={triggerLabel}
      className={cn('jgis-error-tip-content', className)}
      {...props}
    />
  );
}
