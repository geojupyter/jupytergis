/**
 * @jest-environment jsdom
 */

jest.mock('@jupyterlab/apputils', () => ({
  Dialog: class Dialog {},
}));

import {
  getAdjacentStorySegmentIndex,
  shouldIgnoreStoryEditorArrowKeys,
} from '../hooks/useStoryEditorSegmentKeyboard';

describe('storyEditorSegmentKeyboard', () => {
  it('blocks arrow keys in text entry targets', () => {
    const input = document.createElement('input');
    expect(shouldIgnoreStoryEditorArrowKeys(input)).toBe(true);
  });

  it('blocks arrow keys in native selects', () => {
    const select = document.createElement('select');
    expect(shouldIgnoreStoryEditorArrowKeys(select)).toBe(true);
  });

  it('returns adjacent segment indexes within bounds', () => {
    expect(getAdjacentStorySegmentIndex(1, 3, 'ArrowDown')).toBe(2);
    expect(getAdjacentStorySegmentIndex(1, 3, 'ArrowUp')).toBe(0);
    expect(getAdjacentStorySegmentIndex(0, 3, 'ArrowUp')).toBeNull();
    expect(getAdjacentStorySegmentIndex(2, 3, 'ArrowDown')).toBeNull();
  });
});
