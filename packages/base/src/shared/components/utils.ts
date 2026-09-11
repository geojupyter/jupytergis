import { clsx, type ClassValue } from 'clsx';
import { useLayoutEffect } from 'react';
import type * as React from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * JupyterLab Dialog runs Styling.styleNode on the body and restyles native
 * form controls. Undo that so our components keep their own styling.
 */
export function stripJupyterSelectStyling(root: HTMLElement): void {
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

export function stripJupyterButtonStyling(root: HTMLElement): void {
  const buttons =
    root instanceof HTMLButtonElement
      ? [root]
      : Array.from(root.querySelectorAll('button'));

  buttons.forEach(button => {
    button.classList.remove('jp-mod-styled');
  });
}

export function useStripJupyterLabStyling(
  rootRef: React.MutableRefObject<HTMLElement | null>,
  strip: (root: HTMLElement) => void,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const run = (): void => {
      strip(root);
    };

    run();

    const observer = new MutationObserver(() => {
      observer.disconnect();
      run();
      observe();
    });

    const observe = (): void => {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true,
      });
    };

    observe();
    return () => {
      observer.disconnect();
    };
  }, [rootRef, strip]);
}
