export type StorySegmentDisplayMode = 'map' | 'markdown';

export interface IListStoryScrollDrivePayload {
  /** 0–1: viewport center between segment i and i+1 in list scroll space */
  progress: number;
  fromIndex: number;
  toIndex: number;
  fromMode: StorySegmentDisplayMode;
  toMode: StorySegmentDisplayMode;
}
