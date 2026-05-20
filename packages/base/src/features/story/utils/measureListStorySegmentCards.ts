import type { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';

import type { IListStorySegmentCardLayout } from './computeListStoryScrollState';
import { getSegmentDisplayMode } from './segmentDisplayMode';

/** Vertical center of a segment card in the scroller's content coordinates. */
export function cardCenterInScrollerContent(
  scroller: HTMLElement,
  card: HTMLElement,
): number {
  const sTop = scroller.getBoundingClientRect().top;
  const cRect = card.getBoundingClientRect();
  const topInContent = scroller.scrollTop + (cRect.top - sTop);
  return topInContent + cRect.height / 2;
}

export function measureListStorySegmentCards(
  scroller: HTMLElement,
  items: IStorySegmentViewItem[],
): IListStorySegmentCardLayout[] | null {
  const byId = new Map<string, HTMLElement>();
  scroller.querySelectorAll<HTMLElement>('[data-segment-id]').forEach(el => {
    const id = el.getAttribute('data-segment-id');
    if (id) {
      byId.set(id, el);
    }
  });

  const cards: IListStorySegmentCardLayout[] = [];

  for (const item of items) {
    const el = byId.get(item.id);
    if (!el) {
      return null;
    }
    cards.push({
      index: item.index,
      center: cardCenterInScrollerContent(scroller, el),
      contentMode: getSegmentDisplayMode(item.activeSlide),
    });
  }

  return cards;
}
