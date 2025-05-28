import { IDict } from '@jupytergis/schema';
import React from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';
import { ProductData } from '../types/types';

interface IStacCollectionsProps {
  header: string;
  data: IDict<string[] | ProductData[]>;
}

const StacSections = ({ header, data }: IStacCollectionsProps) => {
  if (!header || !data) {
    console.log('Bad props');
    return;
  }

  const handleClick = (val: string[] | ProductData[]) => {
    console.log('val', val);
  };

  return (
    <div>
      <span>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
      >
        {Object.entries(data).map(([key, val]) => (
          <ToggleGroupItem
            className="jgis-stac-browser-collection-item"
            value={key}
            onClick={() => handleClick(val)}
          >
            {key}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default StacSections;
