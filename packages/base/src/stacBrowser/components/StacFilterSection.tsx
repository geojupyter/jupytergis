import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useMemo } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';

interface IStacCollectionsProps {
  header: string;
  data: Record<string, string[]>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
  model: IJupyterGISModel;
}

const StacFilterSection = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
  model
}: IStacCollectionsProps) => {
  // ! Starts here

  // TODO: This sucks lol
  const items = useMemo(() => {
    // TODO: Leaving this here for now
    function isStringArrayRecord(
      data: Record<string, string[]>
    ): data is Record<string, string[]> {
      const firstKey = Object.keys(data)[0];
      return Array.isArray(data[firstKey]);
    }

    if (isStringArrayRecord(data)) {
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
            ))
          );
      }
    } else {
      console.log('shouldnt happen');
      //data is ProductData now. this is so dumb
    }

    return null;
  }, [header, data, selectedCollections]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
        onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
    </div>
  );
};

export default StacFilterSection;
