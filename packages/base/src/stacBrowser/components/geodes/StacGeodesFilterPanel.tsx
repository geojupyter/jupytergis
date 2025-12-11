import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import CheckboxWithLabel from '@/src/shared/components/CheckboxWithLabel';
import StacSearchDatePicker from '@/src/stacBrowser/components/shared/StacSearchDatePicker';
import {
  datasets as datasetsList,
  platforms as platformsList,
  products as productsList,
} from '@/src/stacBrowser/constants';
import { useStacResultsContext } from '@/src/stacBrowser/context/StacResultsContext';
import useGeodesSearch from '@/src/stacBrowser/hooks/useGeodesSearch';
import StacFilterSection from './StacFilterSection';

interface IStacGeodesFilterPanelProps {
  model?: IJupyterGISModel;
}

const StacGeodesFilterPanel = ({ model }: IStacGeodesFilterPanelProps) => {
  const { setResults, setPaginationLinks, selectedUrl } =
    useStacResultsContext();

  const {
    filterState,
    filterSetters,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    useWorldBBox,
    setUseWorldBBox,
  } = useGeodesSearch({
    model,
    apiUrl: selectedUrl,
    setResults,
    setPaginationLinks,
  });

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
      <CheckboxWithLabel
        checked={useWorldBBox}
        onCheckedChange={setUseWorldBBox}
        label="Use whole world as bounding box"
      />
      <StacSearchDatePicker
        startTime={startTime}
        setStartTime={setStartTime}
        endTime={endTime}
        setEndTime={setEndTime}
      />
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
