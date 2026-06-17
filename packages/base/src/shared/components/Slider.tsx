import { Slider as SliderPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from './utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn('jgis-slider', className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="jgis-slider-track"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="jgis-slider-range"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="jgis-slider-thumb"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
