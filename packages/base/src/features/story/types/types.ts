import type { IStorySegmentLayer } from '@jupytergis/schema';

export type StorySegmentDisplayMode = 'map' | 'markdown';

export interface IListStoryScrollDrivePayload {
  /** 0-1: viewport center between segment i and i+1 in list scroll space */
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

export interface IListStorySegmentRange {
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

export interface IListStoryLayout {
  segments: IListStorySegmentRange[];
  /** Sum of segment heights (virtual track height). */
  trackHeight: number;
}
