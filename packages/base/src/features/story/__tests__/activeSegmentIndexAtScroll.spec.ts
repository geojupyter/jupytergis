import { activeSegmentIndexAtScroll } from '../utils/activeSegmentIndexAtScroll';

const rows = [
  { start: 0, size: 100 },
  { start: 100, size: 200 },
  { start: 300, size: 80 },
];

describe('activeSegmentIndexAtScroll', () => {
  it('stays on this segment before the midpoint', () => {
    expect(activeSegmentIndexAtScroll(49, rows)).toBe(0);
    expect(activeSegmentIndexAtScroll(199, rows)).toBe(1);
  });

  it('moves to the next segment at the midpoint', () => {
    expect(activeSegmentIndexAtScroll(50, rows)).toBe(1);
    expect(activeSegmentIndexAtScroll(200, rows)).toBe(2);
  });

  it('stays on the last segment past its midpoint', () => {
    expect(activeSegmentIndexAtScroll(340, rows)).toBe(2);
    expect(activeSegmentIndexAtScroll(500, rows)).toBe(2);
  });
});
