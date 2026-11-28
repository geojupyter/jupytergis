import type { IStorySegmentLayer } from '@jupytergis/schema';

export type StorySegmentDisplayMode = 'map' | 'markdown';

export type StorySegmentPaneAlignment = 'start' | 'center' | 'end';

export const SegmentInteractionMode = {
  mapView: 'map-view',
  previewingSegment: 'previewing-segment',
} as const;

export type SegmentInteractionMode =
  (typeof SegmentInteractionMode)[keyof typeof SegmentInteractionMode];

export type StoryMapInteractionBarPlacement =
  | 'overlay-bottom'
  | 'main-top-left';

export interface IOverrideLayerEntry {
  layerId: string;
  action: 'remove' | 'restore';
}

export interface IStorySegmentViewItem {
  id: string;
  index: number;
  layerName: string;
  activeSlide: IStorySegmentLayer['parameters'] | undefined;
}

export interface IListStoryTitleBarContentProps {
  segmentItems: IStorySegmentViewItem[];
  currentIndex: number;
  onSegmentClick: (index: number) => void;
}
