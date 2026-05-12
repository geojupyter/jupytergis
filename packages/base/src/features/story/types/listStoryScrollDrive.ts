export type StorySegmentDisplayMode = 'map' | 'markdown';

export interface IListStoryScrollDrivePayload {
	progress: number;
	fromIndex: number;
	toIndex: number;
	fromMode: StorySegmentDisplayMode;
	toMode: StorySegmentDisplayMode;
}
