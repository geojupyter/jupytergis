import { IJupyterGISModel } from '@jupytergis/schema';
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

interface IStacViewProps {
  model?: IJupyterGISModel;
}
const StacPanelView = ({ model }: IStacViewProps) => {
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
  } = useStacSearch({ model });

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
          filterState={filterState}
          filterSetters={filterSetters}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
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
