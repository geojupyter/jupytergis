import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';

import { cn } from './utils';

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'size'> & {
  size?: 'sm' | 'default';
};

/**
 * JupyterLab Dialog runs Styling.styleNode on the body and wraps every
 * <select> in .jp-select-wrapper + jp-mod-styled. Undo that so this
 * component keeps its own styling.
 */
function stripJupyterSelectStyling(root: HTMLElement): void {
  root.querySelectorAll(':scope > .jp-select-wrapper').forEach(wrapper => {
    const select = wrapper.querySelector(':scope > select');
    if (!(select instanceof HTMLSelectElement) || !wrapper.parentElement) {
      return;
    }
    select.classList.remove('jp-mod-styled');
    wrapper.parentElement.insertBefore(select, wrapper);
    wrapper.remove();
  });

  root.querySelectorAll(':scope > select').forEach(select => {
    select.classList.remove('jp-mod-styled');
  });
}

function NativeSelect({
  className,
  size = 'default',
  ...props
}: NativeSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const strip = (): void => {
      stripJupyterSelectStyling(root);
    };

    strip();

    const observer = new MutationObserver(() => {
      observer.disconnect();
      strip();
      observer.observe(root, { childList: true, subtree: true });
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        'group/native-select relative w-fit has-[select:disabled]:opacity-50',
        className,
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="border-input hover:bg-muted selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 h-8 w-full min-w-0 appearance-none rounded-lg border bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:ring-3 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5"
        {...props}
      />
      <ChevronDownIcon
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<'option'>) {
  return (
    <option
      data-slot="native-select-option"
      className={cn('bg-[Canvas] text-[CanvasText]', className)}
      {...props}
    />
  );
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<'optgroup'>) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn('bg-[Canvas] text-[CanvasText]', className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
