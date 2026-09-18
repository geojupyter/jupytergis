import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';

const STEP = 0.02;

export interface ISwipeDividerProps {
  fraction: number;
  onFractionChange: (fraction: number) => void;
  onStop: () => void;
}

export function SwipeDivider({
  fraction,
  onFractionChange,
  onStop,
}: ISwipeDividerProps): JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = ref.current?.parentElement;
    if (!container || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const onMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      onFractionChange(
        Math.min(1, Math.max(0, (moveEvent.clientX - rect.left) / rect.width)),
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const offset =
      event.key === 'ArrowLeft' ? -STEP : event.key === 'ArrowRight' ? STEP : 0;
    if (!offset) {
      return;
    }

    // The map listens for keyboard events on `document`, so arrow keys would
    // pan it as well as move the divider.
    event.preventDefault();
    event.stopPropagation();
    onFractionChange(Math.min(1, Math.max(0, fraction + offset)));
  };

  return (
    <div
      ref={ref}
      className="jgis-swipe-divider"
      style={{ left: `${fraction * 100}%` }}
      role="slider"
      tabIndex={0}
      aria-label="Layer comparison divider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="jgis-swipe-divider-stop"
        title="Stop comparing"
        aria-label="Stop comparing"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          onStop();
        }}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
      <span className="jgis-swipe-divider-handle" />
    </div>
  );
}
