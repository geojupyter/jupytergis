import { IListStoryMarkdownSegment } from '../types/types';
import {
  buildPendingMeasureIds,
  LIST_STORY_MEASURE_LOOKAHEAD,
} from '../utils/listStoryMeasureQueue';

function md(id: string, index: number): IListStoryMarkdownSegment {
  return { id, index, markdown: 'x' };
}

describe('buildPendingMeasureIds', () => {
  const segments = [
    md('m0', 0),
    md('m1', 1),
    md('m2', 2),
    md('m3', 3),
    md('m4', 4),
  ];

  it('includes only markdown within lookahead of current index', () => {
    const pending = buildPendingMeasureIds({
      markdownSegments: segments,
      currentSegmentIndex: 2,
      heightsById: {},
      measuringSegmentId: undefined,
    });

    expect(pending).toEqual(['m2', 'm1', 'm3', 'm0', 'm4']);
    expect(
      segments
        .filter(s => Math.abs(s.index - 2) > LIST_STORY_MEASURE_LOOKAHEAD)
        .every(s => !pending.includes(s.id)),
    ).toBe(true);
  });

  it('skips segments that already have heights', () => {
    const pending = buildPendingMeasureIds({
      markdownSegments: segments,
      currentSegmentIndex: 2,
      heightsById: { m1: 100, m2: 200 },
      measuringSegmentId: undefined,
    });

    expect(pending).toEqual(['m3', 'm0', 'm4']);
  });

  it('excludes the segment currently being measured', () => {
    const pending = buildPendingMeasureIds({
      markdownSegments: segments,
      currentSegmentIndex: 2,
      heightsById: {},
      measuringSegmentId: 'm2',
    });

    expect(pending).not.toContain('m2');
    expect(pending[0]).toBe('m1');
  });

  it('returns empty when all nearby segments are measured', () => {
    const pending = buildPendingMeasureIds({
      markdownSegments: segments,
      currentSegmentIndex: 2,
      heightsById: { m0: 1, m1: 1, m2: 1, m3: 1, m4: 1 },
      measuringSegmentId: undefined,
    });

    expect(pending).toEqual([]);
  });
});
