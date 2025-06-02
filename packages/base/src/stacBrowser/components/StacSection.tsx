import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import React, { useMemo } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';

interface IStacCollectionsProps {
  header: string;
  data: IDict<string[]>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
  model: IJupyterGISModel;
}

const StacSections = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
  model
}: IStacCollectionsProps) => {
  // ! Starts here

  const items = useMemo(() => {
    if (header === 'Collection') {
      return Object.entries(data).map(([key, val]) => (
        <ToggleGroupItem
          key={key}
          className="jgis-stac-browser-collection-item"
          value={key}
        >
          {key}
        </ToggleGroupItem>
      ));
    } else if (header === 'Platform') {
      return Object.entries(data)
        .filter(([key]) => selectedCollections.includes(key))
        .flatMap(([key, values]) =>
          values.map(val => (
            <ToggleGroupItem
              key={`${key}-${val}`}
              className="jgis-stac-browser-collection-item"
              value={val}
            >
              {val}
            </ToggleGroupItem>
          ))
        );
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

export default StacSections;
