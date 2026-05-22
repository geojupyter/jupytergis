import type { CSSProperties } from 'react';

export function markdownScrollPaneHeightStyle(
  heightPx: number | undefined,
): CSSProperties | undefined {
  if (!heightPx || heightPx <= 0) {
    return undefined;
  }
  return { height: `${heightPx}px` };
}
