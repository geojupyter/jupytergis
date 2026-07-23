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
 * component keeps its own chrome.
 */
function stripJupyterSelectStyling(root: HTMLElement): void {
  const wrappers = root.querySelectorAll(':scope > .jp-select-wrapper');
  wrappers.forEach(wrapper => {
    const select = wrapper.querySelector(':scope > select');
    if (!(select instanceof HTMLSelectElement) || !wrapper.parentElement) {
      return;
    }
    select.classList.remove('jp-mod-styled');
    wrapper.parentElement.insertBefore(select, wrapper);
    wrapper.remove();
  });

  root.querySelector(':scope > select')?.classList.remove('jp-mod-styled');
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
      className={cn('jgis-native-select', className)}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select data-slot="native-select" data-size={size} {...props} />
      <ChevronDownIcon
        className="jgis-native-select-icon"
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
      className={cn(className)}
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
      className={cn(className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
