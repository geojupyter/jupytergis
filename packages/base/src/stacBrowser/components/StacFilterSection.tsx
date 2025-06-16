import React, { useMemo } from 'react';

import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../shared/components/ToggleGroup';

interface IStacFilterSectionProps {
  header: string;
  data: Record<string, string[]>;
  selectedCollections: string[];
  selectedPlatforms: string[];
  handleToggleGroupValueChange: (val: string[]) => void;
}

const StacFilterSection = ({
  header,
  data,
  selectedCollections,
  selectedPlatforms,
  handleToggleGroupValueChange,
}: IStacFilterSectionProps) => {
  const items = useMemo(() => {
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
          )),
        );
    }

    return null;
  }, [header, data, selectedCollections, selectedPlatforms]);

  // Get the current selected values based on the header
  const currentSelectedValues = useMemo(() => {
    if (header === 'Collection') {
      return selectedCollections;
    }
    if (header === 'Platform') {
      return selectedPlatforms;
    }
    return [];
  }, [header, selectedCollections, selectedPlatforms]);

  return (
    <div>
      <span style={{ fontWeight: 'bold' }}>{header}</span>
      <ToggleGroup
        type="multiple"
        variant={'outline'}
        size={'sm'}
        className="jgis-stac-browser-collection"
        value={currentSelectedValues}
        onValueChange={handleToggleGroupValueChange}
      >
        {items}
      </ToggleGroup>
      {/* <DropdownMenu modal={false}>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent side="right">
          {/* <DropdownMenuLabel>Sentinel 2</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Billing</DropdownMenuItem>
          <DropdownMenuItem>Team</DropdownMenuItem>
          <DropdownMenuItem>Subscription</DropdownMenuItem>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Collections</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Sentinel 1</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>PEPS_S1_L1</DropdownMenuItem>
                  <DropdownMenuItem>PEPS_S1_L2</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Sentinel 2</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>PEPS_S2_L1C</DropdownMenuItem>
                  <DropdownMenuItem>
                    MUSCATE_SENTINEL2_SENTINEL2_L2A
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    MUSCATE_Snow_SENTINEL2_L2B-SNOW
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    MUSCATE_WaterQual_SENTINEL2_L2B-WATER
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    MUSCATE_SENTINEL2_SENTINEL2_L3A
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu> */}
    </div>
  );
};

export default StacFilterSection;
