import { IJupyterGISModel } from '@jupytergis/schema';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React, { useEffect } from 'react';

import { Calendar } from '@/src/shared/components/Calendar';
import { Button } from '../../shared/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../shared/components/Popover';
import { DatasetsType, PlatformsType, ProductsType } from '../constants';
import StacFilterSection from './StacFilterSection';
import { StacFilterState, StacFilterSetters } from '../types/types';

export type Wig = { selectedDatasets: string[]; collection: string };
interface IStacPanelFiltersProps {
  datasets: DatasetsType;
  platforms: PlatformsType;
  products: ProductsType;
  filterState: StacFilterState;
  filterSetters: StacFilterSetters;
  startTime: Date | undefined;
  setStartTime: (date: Date | undefined) => void;
  endTime: Date | undefined;
  setEndTime: (date: Date | undefined) => void;
  model: IJupyterGISModel;
}

const StacPanelFilters = ({
  datasets,
  platforms,
  products,
  filterState,
  filterSetters,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  model,
}: IStacPanelFiltersProps) => {
  const handleDatasetSelection = (dataset: string, collection: string) => {
    const { collections, datasets } = filterState;

    const updatedCollections = new Set(collections);
    updatedCollections.add(collection);
    filterSetters.collections(Array.from(updatedCollections));

    const updatedDatasets = new Set(datasets);
    updatedDatasets.add(dataset);
    filterSetters.datasets(Array.from(updatedDatasets));
  };

  const handlePlatformSelection = (platform: string) => {
    const { platforms } = filterState;

    const updatedPlatforms = new Set(platforms);
    console.log('updatedPlatforms', updatedPlatforms);
    updatedPlatforms.add(platform);
    filterSetters.platforms(Array.from(updatedPlatforms));
  };

  const handleProductSelection = (product: string) => {
    const { products } = filterState;
    const updatedProducts = new Set(products);
    updatedProducts.add(product);
    filterSetters.products(Array.from(updatedProducts));
  };

  useEffect(() => {
    console.log('filterState in filters', filterState);
  }, [filterState]);

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
        data={datasets}
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
