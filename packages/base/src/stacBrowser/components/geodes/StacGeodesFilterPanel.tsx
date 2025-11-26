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
import StacFilterSection from '@/src/stacBrowser/components/geodes/StacFilterSection';
import StacCheckboxWithLabel from '@/src/stacBrowser/components/shared/StacCheckboxWithLabel';
import {
  datasets as datasetsList,
  platforms as platformsList,
  products as productsList,
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
  useWorldBBox: boolean;
  setUseWorldBBox: (val: boolean) => void;
}

const StacGeodesFilterPanel = ({
  filterState,
  filterSetters,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  useWorldBBox,
  setUseWorldBBox,
}: IStacPanelFiltersProps) => {
  const handleDatasetSelection = (dataset: string, collection: string) => {
    const collections = new Set(filterState.collections);
    const datasets = new Set(filterState.datasets);

    if (datasets.has(dataset)) {
      datasets.delete(dataset);
      // Remove the collection if no datasets remain for it
      const datasetsForCollection = Array.from(datasets).filter(d => {
        return datasetsList.some(
          entry =>
            entry.collection === collection && entry.datasets.includes(d),
        );
      });
      if (datasetsForCollection.length === 0) {
        collections.delete(collection);

        const platforms = new Set(filterState.platforms);
        const products = new Set(filterState.products);

        // Remove platforms belonging to this collection
        if (platformsList[collection as keyof typeof platformsList]) {
          platformsList[collection as keyof typeof platformsList].forEach(
            platform => {
              platforms.delete(platform);
            },
          );
        }

        // Remove products belonging to this collection
        productsList
          .filter(product => product.collections.includes(collection))
          .forEach(product => {
            products.delete(product.productCode);
          });

        filterSetters.platforms(platforms);
        filterSetters.products(products);
      }
    } else {
      datasets.add(dataset);
      collections.add(collection);
    }
    filterSetters.collections(collections);
    filterSetters.datasets(datasets);
  };

  const handleToggle = (key: 'platforms' | 'products', value: string) => {
    const updated = new Set(filterState[key]);
    if (updated.has(value)) {
      updated.delete(value);
    } else {
      updated.add(value);
    }
    filterSetters[key](updated);
  };

  return (
    <div className="jgis-stac-browser-filters-panel">
      <StacCheckboxWithLabel
        checked={useWorldBBox}
        onCheckedChange={setUseWorldBBox}
        label="Use whole world as bounding box"
      />
      <div className="jgis-stac-browser-date-picker">
        <Popover>
          <PopoverTrigger asChild>
            <Button style={{ padding: '0 0.5rem' }} variant={'outline'}>
              <CalendarIcon className="jgis-stac-datepicker-icon" />
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
            <Button style={{ padding: '0 0.5rem' }} variant={'outline'}>
              <CalendarIcon className="jgis-stac-datepicker-icon" />
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
        section="Collection"
        data={datasetsList}
        selectedCollections={Array.from(filterState.collections)}
        selectedData={Array.from(filterState.datasets)}
        handleCheckedChange={handleDatasetSelection}
      />
      <StacFilterSection
        section="Platform"
        data={platformsList}
        selectedCollections={Array.from(filterState.collections)}
        selectedData={Array.from(filterState.platforms)}
        handleCheckedChange={platform => handleToggle('platforms', platform)}
      />
      <StacFilterSection
        section="Data / Product"
        data={productsList}
        selectedCollections={Array.from(filterState.collections)}
        selectedData={Array.from(filterState.products)}
        handleCheckedChange={product => handleToggle('products', product)}
      />
      {/* <div>cloud cover</div> */}
    </div>
  );
};
export default StacGeodesFilterPanel;
