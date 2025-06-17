import React, { useMemo } from 'react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shared/components/ToggleGroup';
import { productsByCollection } from '../constants';
import { CollectionName } from '../types/types';

interface IStacSectionProps {
  header: string;
  data: typeof productsByCollection;
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
        (data[collection as CollectionName] || []).map(
          product => product.productCode,
        ),
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
  }, [selectedCollections, data]);

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
