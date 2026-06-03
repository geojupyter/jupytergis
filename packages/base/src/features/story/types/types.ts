import type { IStorySegmentLayer } from '@jupytergis/schema';

export type StorySegmentDisplayMode = 'map' | 'markdown';

/** Active handoff between two segments while scrolling the virtual track. */
export interface IListStorySegmentTransition {
  /** 0–1 across the handoff span (outgoing segment + gap + incoming segment). */
  progress: number;
  fromIndex: number;
  toIndex: number;
  fromMode: StorySegmentDisplayMode;
  toMode: StorySegmentDisplayMode;
}

export interface IStorySegmentViewItem {
  id: string;
  index: number;
  layerName: string;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
}

export interface IListStoryMarkdownSegment {
  id: string;
  index: number;
  markdown: string;
}

export interface IListStoryScrollTrackSegment {
  id: string;
  index: number;
  contentMode: StorySegmentDisplayMode;
  height: number;
  measured: boolean;
  /** Inclusive start in scroller content coordinates. */
  start: number;
  /** Exclusive end in scroller content coordinates. */
  end: number;
}

export interface IListStoryScrollTrackLayout {
  segments: IListStoryScrollTrackSegment[];
  /** Sum of segment heights and handoff gaps (virtual track height). */
  scrollTrackHeight: number;
}
