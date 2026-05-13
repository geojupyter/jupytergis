import type { IJGISStoryMap, IStorySegmentLayer } from '@jupytergis/schema';
import { RefObject, useCallback, useEffect, useRef } from 'react';

import type { IStorySegmentViewItem } from '@/src/features/story/hooks/useStorySegmentViewItems';
import type {
	IListStoryScrollDrivePayload,
	StorySegmentDisplayMode,
} from '@/src/features/story/types/listStoryScrollDrive';

/**
 * List story: maps vertical scroll position of the story column to a
 * `listScrollDrive` payload (progress between two segment indices).
 *
 * - Listens to scroll + resize on `scrollContainerRef` (Specta list scroller).
 * - Finds `[data-segment-id]` cards, measures their vertical centers in
 *   scroll content space, picks the pair bracketing the viewport center.
 * - Skips map→map pairs (no markdown transition to drive).
 * - Emits null when disabled, missing DOM, or geometry is invalid.
 */
function getSegmentDisplayMode(
	activeSlide: IStorySegmentLayer['parameters'] | undefined,
): StorySegmentDisplayMode {
	if (activeSlide?.content?.contentMode === 'markdown') {
		return 'markdown';
	}
	return 'map';
}

function pairNeedsScrollDrive(
	fromMode: StorySegmentDisplayMode,
	toMode: StorySegmentDisplayMode,
): boolean {
	return !(fromMode === 'map' && toMode === 'map');
}

/** Vertical center of a segment card in the scroller's content coordinates. */
function cardCenterInScrollerContent(
	scroller: HTMLElement,
	card: HTMLElement,
): number {
	const sTop = scroller.getBoundingClientRect().top;
	const cRect = card.getBoundingClientRect();
	const topInContent = scroller.scrollTop + (cRect.top - sTop);
	return topInContent + cRect.height / 2;
}

export interface IUseListStoryScrollDriveParams {
	enabled: boolean;
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	storyData: IJGISStoryMap | null;
	items: IStorySegmentViewItem[];
	onDriveChange: (payload: IListStoryScrollDrivePayload | null) => void;
}

/** Subscribes to list scroller geometry; calls `onDriveChange` (→ MainView). */
export function useListStoryScrollDrive({
	enabled,
	scrollContainerRef,
	storyData,
	items,
	onDriveChange,
}: IUseListStoryScrollDriveParams): void {
	const onDriveChangeRef = useRef(onDriveChange);
	onDriveChangeRef.current = onDriveChange;

	const rafIdRef = useRef<number | null>(null);

	const computeAndEmit = useCallback(() => {
		const scroller = scrollContainerRef.current;
		if (!enabled || !scroller || items.length < 2 || !storyData) {
			onDriveChangeRef.current(null);
			return;
		}

		const byId = new Map<string, HTMLElement>();
		scroller.querySelectorAll<HTMLElement>('[data-segment-id]').forEach(el => {
			const id = el.getAttribute('data-segment-id');
			if (id) {
				byId.set(id, el);
			}
		});

		const centers: Array<number | null> = items.map(item => {
			const el = byId.get(item.id);
			if (!el) {
				return null;
			}
			return cardCenterInScrollerContent(scroller, el);
		});

		if (centers.some(c => c === null)) {
			onDriveChangeRef.current(null);
			return;
		}

		const numericCenters = centers as number[];
		const scrollCenter = scroller.scrollTop + scroller.clientHeight / 2;

		let pairIndex: number | null = null;
		for (let i = 0; i < numericCenters.length - 1; i++) {
			const a = numericCenters[i];
			const b = numericCenters[i + 1];
			if (a <= scrollCenter && scrollCenter <= b) {
				pairIndex = i;
				break;
			}
		}

		if (pairIndex === null) {
			onDriveChangeRef.current(null);
			return;
		}

		const fromItem = items[pairIndex];
		const toItem = items[pairIndex + 1];
		const fromMode = getSegmentDisplayMode(fromItem.activeSlide);
		const toMode = getSegmentDisplayMode(toItem.activeSlide);

		// Map-only boundary: no markdown overlay to interpolate.
		if (!pairNeedsScrollDrive(fromMode, toMode)) {
			onDriveChangeRef.current(null);
			return;
		}

		const c0 = numericCenters[pairIndex];
		const c1 = numericCenters[pairIndex + 1];
		const span = c1 - c0;
		if (span <= 0) {
			onDriveChangeRef.current(null);
			return;
		}

		const progress = Math.min(1, Math.max(0, (scrollCenter - c0) / span));

		onDriveChangeRef.current({
			progress,
			fromIndex: fromItem.index,
			toIndex: toItem.index,
			fromMode,
			toMode,
		});
	}, [enabled, items, scrollContainerRef, storyData]);

	const scheduleCompute = useCallback(() => {
		if (rafIdRef.current !== null) {
			return;
		}
		rafIdRef.current = window.requestAnimationFrame(() => {
			rafIdRef.current = null;
			computeAndEmit();
		});
	}, [computeAndEmit]);

	useEffect(() => {
		if (!enabled) {
			onDriveChangeRef.current(null);
			return;
		}

		const scroller = scrollContainerRef.current;
		if (!scroller) {
			onDriveChangeRef.current(null);
			return;
		}

		const handleScroll = () => {
			scheduleCompute();
		};

		scroller.addEventListener('scroll', handleScroll, { passive: true });
		const ro = new ResizeObserver(() => {
			scheduleCompute();
		});
		ro.observe(scroller);

		scheduleCompute();

		return () => {
			scroller.removeEventListener('scroll', handleScroll);
			ro.disconnect();
			if (rafIdRef.current !== null) {
				window.cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			onDriveChangeRef.current(null);
		};
	}, [enabled, scrollContainerRef, scheduleCompute]);
}
