import type {
  IListStoryScrollDrivePayload,
  StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';

import { pairNeedsScrollDrive } from './segmentDisplayMode';

export interface IListStorySegmentCardLayout {
  index: number;
  center: number;
  contentMode: StorySegmentDisplayMode;
}

export interface IListStoryScrollState {
  activeIndex: number;
  drive: IListStoryScrollDrivePayload | null;
}

export interface IComputeListStoryScrollInput {
  scrollCenter: number;
  cards: IListStorySegmentCardLayout[];
  prev: IListStoryScrollState | null;
}

/** Pure list-scroll geometry: active segment index + overlay drive from one layout pass. */
export function computeListStoryScrollState({
  scrollCenter,
  cards,
  prev,
}: IComputeListStoryScrollInput): IListStoryScrollState | null {
  if (!cards.length) {
    return null;
  }

  if (cards.length === 1) {
    return {
      activeIndex: cards[0].index,
      drive: null,
    };
  }

  const centers = cards.map(card => card.center);

  let pairIndex: number | null = null;
  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    if (a <= scrollCenter && scrollCenter <= b) {
      pairIndex = i;
      break;
    }
  }

  let inGap = false;
  if (pairIndex === null) {
    if (scrollCenter <= centers[0]) {
      pairIndex = 0;
    } else if (scrollCenter >= centers[centers.length - 1]) {
      pairIndex = centers.length - 2;
    } else {
      inGap = true;
    }
  }

  if (inGap) {
    return prev;
  }

  const fromCard = cards[pairIndex!];
  const toCard = cards[pairIndex! + 1];
  const c0 = fromCard.center;
  const c1 = toCard.center;
  const span = c1 - c0;

  if (span <= 0) {
    return prev;
  }

  const progress = Math.min(1, Math.max(0, (scrollCenter - c0) / span));
  const activeIndex = progress >= 0.5 ? toCard.index : fromCard.index;

  const drive = pairNeedsScrollDrive(fromCard.contentMode, toCard.contentMode)
    ? {
        progress,
        fromIndex: fromCard.index,
        toIndex: toCard.index,
        fromMode: fromCard.contentMode,
        toMode: toCard.contentMode,
      }
    : null;

  return { activeIndex, drive };
}
