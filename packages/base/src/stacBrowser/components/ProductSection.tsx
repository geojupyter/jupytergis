import React, { useMemo } from 'react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shared/components/ToggleGroup';
import { getProductCodesForCollection } from '../StacBrowser';
import { CollectionName, IProductData } from '../types/types';

interface IStacSectionProps {
  header: string;
  data: Record<string, IProductData>;
  selectedCollections: string[];
  selectedProducts: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
}

const ProductSection = ({
  header,
  data,
  selectedCollections,
  selectedProducts,
  handleToggleGroupValueChange,
}: IStacSectionProps) => {
  const items = useMemo(() => {
    const productCodesForCollections = selectedCollections
      .map(collection =>
        getProductCodesForCollection(collection as CollectionName),
      )
      .flat();

    return productCodesForCollections.map(val => (
      <ToggleGroupItem
        key={`${val}`}
        className="jgis-stac-browser-section-item"
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
        value={selectedProducts}
        onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
    </div>
  );
};

export default ProductSection;
