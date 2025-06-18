import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import { Calendar } from '@/src/shared/components/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/src/shared/components/Popover';
import StacFilterSection from '@/src/stacBrowser/components/StacFilterSection';
import {
  datasets as datasetsList,
  platforms,
  products,
} from '@/src/stacBrowser/constants';
import {
  StacFilterState,
  StacFilterSetters,
} from '@/src/stacBrowser/types/types';

interface IStacPanelFiltersProps {
  filterState: StacFilterState;
  filterSetters: StacFilterSetters;
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
}

const StacPanelFilters = ({
  filterState,
  filterSetters,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: IStacPanelFiltersProps) => {
  const handleDatasetSelection = (dataset: string, collection: string) => {
    const { collections, datasets } = filterState;

    const updatedDatasets = new Set(datasets);
    const updatedCollections = new Set(collections);

    if (updatedDatasets.has(dataset)) {
      updatedDatasets.delete(dataset);
      // Remove the collection if no datasets remain for it
      const datasetsForCollection = Array.from(updatedDatasets).filter(d => {
        // Find all datasets for this collection
        return datasetsList.some(
          entry =>
            entry.collection === collection && entry.datasets.includes(d),
        );
      });

      if (datasetsForCollection.length === 0) {
        updatedCollections.delete(collection);
      }
    } else {
      updatedDatasets.add(dataset);
      updatedCollections.add(collection);
    }
    filterSetters.collections(Array.from(updatedCollections));
    filterSetters.datasets(Array.from(updatedDatasets));
  };

  const handlePlatformSelection = (platform: string) => {
    const { platforms } = filterState;

    const updatedPlatforms = new Set(platforms);
    if (updatedPlatforms.has(platform)) {
      updatedPlatforms.delete(platform);
    } else {
      updatedPlatforms.add(platform);
    }
    filterSetters.platforms(Array.from(updatedPlatforms));
  };

  const handleProductSelection = (product: string) => {
    const { products } = filterState;

    const updatedProducts = new Set(products);
    if (updatedProducts.has(product)) {
      updatedProducts.delete(product);
    } else {
      updatedProducts.add(product);
    }
    filterSetters.products(Array.from(updatedProducts));
  };

  return (
    <div className="jgis-stac-browser-filters-panel">
      <div className="jgis-stac-browser-date-picker">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={'outline'}>
              <CalendarIcon />
              {startTime ? format(startTime, 'PPP') : <span>Start Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={startTime}
              onSelect={setStartTime}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={'outline'}>
              <CalendarIcon />
              {endTime ? format(endTime, 'PPP') : <span>End Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={endTime}
              onSelect={setEndTime}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <StacFilterSection
        header="Collection"
        data={datasetsList}
        selectedCollections={filterState.collections}
        selectedData={filterState.datasets}
        handleCheckedChange={handleDatasetSelection}
      />
      <StacFilterSection
        header="Platform"
        data={platforms}
        selectedCollections={filterState.collections}
        selectedData={filterState.platforms}
        handleCheckedChange={handlePlatformSelection}
      />

      <StacFilterSection
        header="Data / Product"
        data={products}
        selectedCollections={filterState.collections}
        selectedData={filterState.products}
        handleCheckedChange={handleProductSelection}
      />
      {/* <div>cloud cover</div> */}
    </div>
  );
};
export default StacPanelFilters;
