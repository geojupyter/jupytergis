import React from 'react';

import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../shared/components/Tabs';
import useStacSearch from '../hooks/useStacSearch';
import { IStacViewProps } from '../types/types';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products,
}: IStacViewProps) => {
  const {
    filterState,
    filterSetters,
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
    formatResult,
    isLoading,
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
          filterState={filterState}
          filterSetters={filterSetters}
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
          isLoading={isLoading}
        />
      </TabsContent>
    </Tabs>
  );
};

export default StacPanelView;
