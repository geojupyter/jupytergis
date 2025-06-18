import { ChevronRight } from 'lucide-react';
import React, { useMemo } from 'react';

import Badge from '@/src/shared/components/Badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/src/shared/components/DropdownMenu';
import {
  datasets,
  DatasetsType,
  platforms,
  PlatformsType,
  products,
  ProductsType,
} from '../constants';

interface IStacFilterSectionProps {
  header: string;
  data: DatasetsType | PlatformsType | ProductsType;
  selectedCollections: string[];
  selectedData: string[]; // Datasets, Platforms, Products
  handleCheckedChange: (dataset: string, collection: string) => void;
}

const StacFilterSection = ({
  header,
  data,
  selectedCollections = [],
  selectedData = [],
  handleCheckedChange,
}: IStacFilterSectionProps) => {
  const items = useMemo(() => {
    if (header === 'Collection') {
      return (
        <DropdownMenuGroup>
          {datasets.map(entry => (
            <DropdownMenuSub key={entry.collection}>
              <DropdownMenuSubTrigger>
                {entry.collection}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {entry.datasets.map(dataset => (
                    <DropdownMenuCheckboxItem
                      key={dataset}
                      checked={selectedData.includes(dataset)}
                      onCheckedChange={() => {
                        handleCheckedChange(dataset, entry.collection);
                      }}
                      onSelect={e => {
                        e.preventDefault();
                      }}
                    >
                      {dataset}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          ))}
        </DropdownMenuGroup>
      );
    }

    if (header === 'Platform') {
      return (
        <>
          {selectedCollections.map(collection => (
            <DropdownMenuGroup key={collection}>
              <DropdownMenuLabel>{collection}</DropdownMenuLabel>
              {platforms[collection as keyof typeof platforms].map(platform => (
                <DropdownMenuCheckboxItem
                  key={platform}
                  checked={selectedData.includes(platform)}
                  onCheckedChange={() => {
                    handleCheckedChange(platform, '');
                  }}
                  onSelect={e => {
                    e.preventDefault();
                  }}
                >
                  {platform}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </>
      );
    }

    if (header === 'Data / Product') {
      return (
        <>
          {selectedCollections.map(collection => (
            <DropdownMenuGroup key={collection}>
              <DropdownMenuLabel>{collection}</DropdownMenuLabel>
              {products
                .filter(product => product.collections.includes(collection))
                .map(product => (
                  <DropdownMenuCheckboxItem
                    key={product.productCode}
                    checked={selectedData.includes(product.productCode)}
                    onCheckedChange={() => {
                      handleCheckedChange(product.productCode, collection);
                    }}
                    onSelect={e => {
                      e.preventDefault();
                    }}
                  >
                    {product.productCode}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          ))}
        </>
      );
    }
  }, [header, data, selectedCollections, handleCheckedChange]);

  return (
    <div className="jgis-stac-filter-section-container">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="jgis-stac-filter-trigger">
          {header}
          <ChevronRight className="DropdownMenuIcon" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right">{items}</DropdownMenuContent>
      </DropdownMenu>
      <div className="jgis-stac-filter-section-badges">
        {selectedData.map(data => (
          <Badge key={data}>{data}</Badge>
        ))}
      </div>
    </div>
  );
};

export default StacFilterSection;
