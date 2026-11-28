/** Row position whose segment is active at this scroll offset. */
export function activeSegmentIndexAtScroll(
  scrollOffset: number,
  rows: readonly { start: number; size: number }[],
): number {
  if (rows.length === 0 || scrollOffset < rows[0].start) {
    return 0;
  }

  let rowIndex = rows.length - 1;

  for (let i = 0; i < rows.length; i++) {
    if (scrollOffset < rows[i].start + rows[i].size) {
      rowIndex = i;
      break;
    }
  }

  const row = rows[rowIndex];

  if (
    rowIndex < rows.length - 1 &&
    row.size > 0 &&
    // Trigger segment swap when scroll is at half way point
    scrollOffset >= row.start + row.size / 2
  ) {
    return rowIndex + 1;
  }

  return rowIndex;
}
