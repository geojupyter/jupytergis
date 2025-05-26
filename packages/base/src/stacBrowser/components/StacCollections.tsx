import React from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';
import { IStacViewProps } from '../StacBrowser';

type IStacCollectionsProps = Pick<IStacViewProps, 'datasetsMap'>;

const StacCollections = ({ datasetsMap }: IStacCollectionsProps) => {
  const handleClick = (val: string[]) => {
    console.log('val', val);
  };

  return (
    <ToggleGroup
      type="multiple"
      variant={'outline'}
      size={'sm'}
      className="jgis-stac-browser-collection"
    >
      {Object.entries(datasetsMap).map(([key, val]) => (
        <ToggleGroupItem
          className="jgis-stac-browser-collection-item"
          value={key}
          onClick={() => handleClick(val)}
        >
          {key}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};

export default StacCollections;
