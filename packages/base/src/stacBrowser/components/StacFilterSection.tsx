import React, { useMemo } from 'react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shared/components/ToggleGroup';

interface IStacFilterSectionProps {
  header: string;
  data: Record<string, string[]>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
}

const StacFilterSection = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
}: IStacFilterSectionProps) => {
  const items = useMemo(() => {
    if (header === 'Collection') {
      return Object.entries(data).map(([key, val]) => (
        <ToggleGroupItem
          key={key}
          className="jgis-stac-browser-section-item"
          value={key}
        >
          {key}
        </ToggleGroupItem>
      ));
    }

    if (header === 'Platform') {
      return Object.entries(data)
        .filter(([key]) => selectedCollections.includes(key))
        .flatMap(([key, values]) =>
          values.map(val => (
            <ToggleGroupItem
              key={`${key}-${val}`}
              className="jgis-stac-browser-section-item"
              value={val}
            >
              {val}
            </ToggleGroupItem>
          )),
        );
    }

    return null;
  }, [header, data, selectedCollections, selectedPlatforms]);

  // Get the current selected values based on the header
  const currentSelectedValues = useMemo(() => {
    if (header === 'Collection') {
      return selectedCollections;
    }
    if (header === 'Platform') {
      return selectedPlatforms;
    }
    return [];
  }, [header, selectedCollections, selectedPlatforms]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
        value={currentSelectedValues}
        onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
    </div>
  );
};

export default StacFilterSection;
