import React from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../shared/components/Tabs';
import useStacSearch from '../hooks/useStacSearch';
import { IStacViewProps } from '../types/types';
import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products
}: IStacViewProps) => {
  const {
    selectedCollections,
    setSelectedCollections,
    selectedPlatforms,
    setSelectedPlatforms,
    selectedProducts,
    setSelectedProducts,
    results,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    totalPages,
    currentPage,
    totalResults,
    handlePaginationClick,
    handleResultClick,
    formatResult
  } = useStacSearch({ datasets, platforms, products, model });

  if (!model) {
    return null;
  }

  return (
    <Tabs defaultValue="filters" className="jgis-stac-browser-main">
      <TabsList>
        <TabsTrigger className="jGIS-layer-browser-category" value="filters">
          Filters
        </TabsTrigger>
        <TabsTrigger
          className="jGIS-layer-browser-category"
          value="results"
        >{`Results (${totalResults})`}</TabsTrigger>
      </TabsList>
      <TabsContent style={{ marginTop: 0 }} value="filters">
        <StacPanelFilters
          datasets={datasets}
          platforms={platforms}
          products={products}
          selectedCollections={selectedCollections}
          setSelectedCollections={setSelectedCollections}
          selectedPlatforms={selectedPlatforms}
          setSelectedPlatforms={setSelectedPlatforms}
          selectedProducts={selectedProducts}
          setSelectedProducts={setSelectedProducts}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          model={model}
        />
      </TabsContent>
      <TabsContent style={{ marginTop: 0 }} value="results">
        <StacPanelResults
          results={results}
          currentPage={currentPage}
          totalPages={totalPages}
          handlePaginationClick={handlePaginationClick}
          handleResultClick={handleResultClick}
          formatResult={formatResult}
        />
      </TabsContent>
    </Tabs>
  );
};

export default StacPanelView;
