import React, { useRef } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  ComboboxVirtualizedList,
  createComboboxVirtualHighlightHandler,
  type ComboboxVirtualizer,
} from '@/src/shared/components/Combobox';
import {
  getProjectionOption,
  PROJECTION_OPTIONS,
  projectionMatches,
  type IProjectionOption,
} from './projectionOptions';

interface IProjectionComboboxProps {
  code: string | undefined;
  onProjectionChange?: (code: string) => void;
}

export function ProjectionCombobox({
  code,
  onProjectionChange,
}: IProjectionComboboxProps): JSX.Element {
  const virtualizerRef = useRef<ComboboxVirtualizer | null>(null);
  const selected =
    getProjectionOption(code) ??
    (code ? { code, name: code, proj4string: '' } : null);

  return (
    <Combobox
      virtualized
      items={PROJECTION_OPTIONS}
      value={selected}
      filter={projectionMatches}
      itemToStringLabel={(option: IProjectionOption) => option.code}
      isItemEqualToValue={(
        option: IProjectionOption,
        value: IProjectionOption,
      ) => option.code === value.code}
      onValueChange={(option: IProjectionOption | null) => {
        if (!option) {
          return;
        }

        onProjectionChange?.(option.code);
      }}
      onItemHighlighted={createComboboxVirtualHighlightHandler(virtualizerRef)}
    >
      <ComboboxTrigger
        className="h-4 min-h-0 border-0 bg-transparent px-1 text-inherit shadow-none"
        render={<Button variant="ghost" size="xs" />}
      >
        <ComboboxValue placeholder="EPSG" />
      </ComboboxTrigger>
      <ComboboxContent side="top" align="center" className="w-80">
        <ComboboxInput
          aria-label="Projection"
          placeholder="Search projections"
          showTrigger={false}
        />
        <ComboboxEmpty>No projections found.</ComboboxEmpty>
        <ComboboxList virtualized>
          <ComboboxVirtualizedList virtualizerRef={virtualizerRef}>
            {(option: IProjectionOption) => (
              <span className="virtual-item flex min-w-0 items-baseline gap-2">
                <span className="shrink-0">{option.code}</span>
                <span className="truncate text-muted-foreground">
                  {option.name}
                </span>
              </span>
            )}
          </ComboboxVirtualizedList>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
