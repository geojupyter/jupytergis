import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useMemo } from 'react';
import {
  ToggleGroup,
  ToggleGroupItem
} from '../../shared/components/ToggleGroup';
import { getProductCodesForCollection } from '../StacBrowser';
import { CollectionName, IProductData } from '../types/types';

interface IStacCollectionsProps {
  header: string;
  data: Record<string, IProductData>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: IProductData[]) => void;
  model: IJupyterGISModel;
}

const ProductSection = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
  model
}: IStacCollectionsProps) => {
  // ! Starts here
  const items = useMemo(() => {
    const productCodesForCollections = selectedCollections
      .map(collection =>
        getProductCodesForCollection(collection as CollectionName)
      )
      .flat();

    return productCodesForCollections.map(val => (
      <ToggleGroupItem
        key={`${val}`}
        className="jgis-stac-browser-collection-item"
        value={val}
      >
        {val}
      </ToggleGroupItem>
    ));
  }, [selectedCollections]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
        onValueChange={val => console.log('val', val)}
        // onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
    </div>
  );
};

export default ProductSection;
