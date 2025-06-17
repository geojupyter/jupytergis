import { IJupyterGISModel } from '@jupytergis/schema';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';

import { Calendar } from '@/src/shared/components/Calendar';
import StacFilterSection from './StacFilterSection';
import { Button } from '../../shared/components/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../shared/components/Popover';
import { DatasetsType, PlatformsType, ProductsType } from '../constants';

interface IStacPanelFiltersProps {
  datasets: DatasetsType;
  platforms: PlatformsType;
  products: ProductsType;
  selectedCollections: string[];
  setSelectedCollections: (val: string[]) => void;
  selectedPlatforms: string[];
  setSelectedPlatforms: (val: string[]) => void;
  selectedProducts: string[];
  setSelectedProducts: (val: string[]) => void;
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
  selectedCollections,
  setSelectedCollections,
  selectedPlatforms,
  setSelectedPlatforms,
  selectedProducts,
  setSelectedProducts,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
}: IStacPanelFiltersProps) => {
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
        selectedCollections={selectedCollections}
        selectedPlatforms={selectedPlatforms}
        handleToggleGroupValueChange={setSelectedCollections}
      />
      <StacFilterSection
        header="Platform"
        data={platforms}
        selectedCollections={selectedCollections}
        selectedPlatforms={selectedPlatforms}
        handleToggleGroupValueChange={setSelectedPlatforms}
      />
      <StacFilterSection
        header="Data / Product"
        data={products}
        selectedCollections={selectedCollections}
        selectedProducts={selectedProducts}
        handleToggleGroupValueChange={setSelectedProducts}
      />
      {/* <div>cloud cover</div> */}
    </div>
  );
};
export default StacPanelFilters;
