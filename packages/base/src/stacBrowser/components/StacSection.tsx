import { IDict } from '@jupytergis/schema';
import React, { useMemo } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';

interface IStacCollectionsProps {
  header: string;
  data: IDict<string[]>;
  selectedCollections: string[];
  handleToggleGroupValueChange?: (val: string[]) => void;
}

const StacSections = ({
  header,
  data,
  selectedCollections,
  handleToggleGroupValueChange
}: IStacCollectionsProps) => {
  const handleClick = (val: string | string[]) => {
    console.log('val', val);
  };

  const items = useMemo(() => {
    if (header === 'Collection') {
      return Object.entries(data).map(([key, val]) => (
        <ToggleGroupItem
          key={key}
          className="jgis-stac-browser-collection-item"
          value={key}
          onClick={() => handleClick(val)}
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
              onClick={() => handleClick(val)}
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
      <span>{header}</span>
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
