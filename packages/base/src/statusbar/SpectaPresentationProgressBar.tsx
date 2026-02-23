import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useRef, useState } from 'react';

interface SpectaPresentationProgressBarProps {
  model: IJupyterGISModel;
}

function SpectaPresentationProgressBar({
  model,
}: SpectaPresentationProgressBarProps) {
  const segmentCount =
    model.getSelectedStory().story?.storySegments?.length ?? 0;
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, model.getCurrentSegmentIndex() ?? 0),
  );

  useEffect(() => {
    const onIndexChanged = (_: IJupyterGISModel, index: number) => {
      setCurrentIndex(Math.max(0, index ?? 0));
    };
    model.currentSegmentIndexChanged.connect(onIndexChanged);
    return () => {
      model.currentSegmentIndexChanged.disconnect(onIndexChanged);
    };
  }, [model]);

  const safeCount = Math.max(0, segmentCount);
  const clampedIndex =
    safeCount > 0 ? Math.min(currentIndex, safeCount - 1) : 0;

  const prevIndexRef = useRef(clampedIndex);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);

  useEffect(() => {
    const prev = prevIndexRef.current;
    if (clampedIndex !== prev) {
      setDirection(clampedIndex > prev ? 'next' : 'prev');
      prevIndexRef.current = clampedIndex;
    }
  }, [clampedIndex]);

  const { story } = model.getSelectedStory();
  const segmentIds = story?.storySegments ?? [];
  const currentSegmentId = segmentIds[clampedIndex];
  const currentSegment = currentSegmentId
    ? model.getLayer(currentSegmentId)
    : undefined;
  const segmentParams = currentSegment?.parameters as
    | { transition?: { time?: number } }
    | undefined;
  const transitionTime = segmentParams?.transition?.time ?? 0.3;

  return (
    <div
      className="jgis-specta-progress"
      data-direction={direction ?? undefined}
      style={
        {
          '--jgis-specta-transition-duration': `${transitionTime}s`,
        } as React.CSSProperties
      }
    >
      <div className="jgis-specta-progress-bar bar">
        {Array.from({ length: safeCount }, (_, i) => safeCount - 1 - i).map(
          segmentIndex => (
            <React.Fragment key={segmentIndex}>
              <input
                type="radio"
                name="jgis-specta-segment"
                value={segmentIndex}
                id={`jgis-specta-segment-${segmentIndex}`}
                className="bar-input jgis-specta-progress-input"
                checked={clampedIndex === segmentIndex}
                onChange={() => {
                  model.setCurrentSegmentIndex(segmentIndex);
                }}
                aria-label={`Segment ${segmentIndex + 1} of ${safeCount}`}
              />
              <div
                className="bar-view"
                style={
                  { '--segment-index': segmentIndex } as React.CSSProperties
                }
              >
                <label
                  className="bar-button jgis-specta-progress-button"
                  htmlFor={`jgis-specta-segment-${segmentIndex}`}
                />
              </div>
            </React.Fragment>
          ),
        )}
      </div>
    </div>
  );
}

export default SpectaPresentationProgressBar;
