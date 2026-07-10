import type { IDrawCustomPropertyPresets } from '@jupytergis/schema';
import { ChevronDown } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';

interface IDrawCustomPropertiesPresetsMenuProps {
  presets: IDrawCustomPropertyPresets;
  presetNames: string[];
  onLoadPreset: (name: string) => void;
  portalContainerRef: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}

export function DrawCustomPropertiesPresetsMenu({
  presets,
  presetNames,
  onLoadPreset,
  portalContainerRef,
  disabled = false,
}: IDrawCustomPropertiesPresetsMenuProps): JSX.Element | null {
  if (presetNames.length === 0) {
    return null;
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          Presets
          <ChevronDown data-icon="inline-end" className="jgis-inline-icon" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="jgis-draw-custom-properties-presets-menu"
        portalContainer={portalContainerRef.current}
      >
        {presetNames.map(name => {
          const propertyCount = presets[name]?.length ?? 0;

          return (
            <DropdownMenuItem
              key={name}
              className="jgis-draw-custom-properties-preset-item"
              onSelect={() => onLoadPreset(name)}
            >
              <span className="jgis-draw-custom-properties-preset-name">
                {name}
              </span>
              <DropdownMenuShortcut>
                {propertyCount}{' '}
                {propertyCount === 1 ? 'property' : 'properties'}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
