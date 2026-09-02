import { AlertTriangle, Info, XCircle, X } from 'lucide-react';
import * as React from 'react';

import { cn } from './utils';

export type ErrorBannerVariant = 'info' | 'warning' | 'error';

interface IErrorBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The message to display in the banner.
   */
  message: React.ReactNode;
  /**
   * The severity of the message. Controls the icon and colour.
   *
   * @default 'error'
   */
  variant?: ErrorBannerVariant;
  /**
   * Called when the user dismisses the banner. When omitted the banner is not
   * dismissable and no close button is rendered.
   */
  onDismiss?: () => void;
}

const variantIcon: Record<ErrorBannerVariant, React.ReactNode> = {
  info: <Info data-size="md" />,
  warning: <AlertTriangle data-size="md" />,
  error: <XCircle data-size="md" />,
};

const variantLabel: Record<ErrorBannerVariant, string> = {
  info: 'Information',
  warning: 'Warning',
  error: 'Error',
};

/**
 * A dismissable inline banner for surfacing scoped messages (info / warning /
 * error) inside a dialog body, side panel or any other React tree.
 *
 * For app-global messages that are not tied to a specific open surface, use
 * `Notification` from `@jupyterlab/apputils` instead.
 */
export function ErrorBanner({
  message,
  variant = 'error',
  onDismiss,
  className,
  ...props
}: IErrorBannerProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      data-variant={variant}
      className={cn('jgis-error-banner', className)}
      {...props}
    >
      <span className="jgis-error-banner-icon" aria-hidden="true">
        {variantIcon[variant]}
      </span>
      <span className="jgis-sr-only">{variantLabel[variant]}:</span>
      <span className="jgis-error-banner-message">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="jgis-error-banner-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X data-size="sm" />
        </button>
      )}
    </div>
  );
}

export default ErrorBanner;
