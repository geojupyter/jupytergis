import React, { useEffect, useMemo } from 'react';

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
  PlatformsType,
  ProductsType,
} from '../constants';

interface IStacFilterSectionProps {
  header: string;
  data: DatasetsType | PlatformsType | ProductsType;
  selectedCollections: string[];
  selectedData: string[];
  handleCheckedChange: (dataset: string, collection: string) => void;
}

const StacFilterSection = ({
  header,
  data,
  selectedCollections = [],
  selectedData = [],
  handleCheckedChange,
}: IStacFilterSectionProps) => {
  useEffect(() => {
    console.log('data in filter section', data);
  }, [data]);

  const items = useMemo(() => {
    if (header === 'Collection') {
      return (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger>{header}</DropdownMenuTrigger>
          <DropdownMenuContent side="right">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{header}</DropdownMenuLabel>
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
                        >
                          {dataset}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return null;
  }, [header, data, selectedCollections, handleCheckedChange]);

  // Get the current selected values based on the header
  const currentSelectedValues = useMemo(() => {
    if (header === 'Collection') {
      return selectedCollections;
    }
    return [];
  }, [header, selectedCollections]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>

      {items}
    </div>
  );
};

export default StacFilterSection;
