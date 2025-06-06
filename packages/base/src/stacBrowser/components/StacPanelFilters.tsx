import { IJupyterGISModel } from '@jupytergis/schema';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React from 'react';
import { Button } from '../../shared/components/Button';
import Calendar from '../../shared/components/Calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../shared/components/Popover';
import { cn } from '../../shared/components/utils';
import { IProductData } from '../types/types';
import ProductSection from './ProductSection';
import StacFilterSection from './StacFilterSection';

interface IStacPanelFiltersProps {
  datasets: Record<string, string[]>;
  platforms: Record<string, string[]>;
  products: Record<string, IProductData>;
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
  model
}: IStacPanelFiltersProps) => {
  return (
    <div className="jgis-stac-browser-filters-panel">
      {/* <div>save/load filter</div> */}
      <div className="jgis-stac-browser-date-picker">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className={cn(
                'w-[280px] justify-start text-left font-normal',
                !startTime && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startTime ? format(startTime, 'PPP') : <span>Start Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startTime}
              onSelect={setStartTime}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className={cn(
                'w-[280px] justify-start text-left font-normal',
                !endTime && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endTime ? format(endTime, 'PPP') : <span>End Date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endTime}
              onSelect={setEndTime}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {/* <div>where</div> */}
      <StacFilterSection
        header="Collection"
        data={datasets}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={setSelectedCollections}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <StacFilterSection
        header="Platform"
        data={platforms}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={setSelectedPlatforms}
        selectedPlatforms={selectedPlatforms}
        model={model}
      />
      <ProductSection
        header="Data / Product"
        data={products}
        selectedCollections={selectedCollections}
        handleToggleGroupValueChange={setSelectedProducts}
        selectedProducts={selectedProducts}
        model={model}
      />
      {/* <div>cloud cover</div> */}
    </div>
  );
};
export default StacPanelFilters;
