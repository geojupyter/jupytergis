import { computeListStoryOverlayHeight } from '../utils/computeListStoryOverlayHeight';

describe('computeListStoryOverlayHeight', () => {
  it('returns the stage viewport height', () => {
    expect(computeListStoryOverlayHeight(600)).toBe(600);
  });

  it('clamps negative values to zero', () => {
    expect(computeListStoryOverlayHeight(-10)).toBe(0);
  });
});
