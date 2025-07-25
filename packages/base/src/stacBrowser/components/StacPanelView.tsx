import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import useStacSearch from '@/src/stacBrowser/hooks/useStacSearch';
import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';

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
    useWorldBBox,
    setUseWorldBBox,
  } = useStacSearch({ model });

  if (!model) {
    return null;
  }

  return (
    <Tabs defaultValue="filters" className="jgis-panel-tabs">
      <TabsList style={{ borderRadius: 0 }}>
        <TabsTrigger className="jGIS-layer-browser-category" value="filters">
          Filters
        </TabsTrigger>
        <TabsTrigger
          className="jGIS-layer-browser-category"
          value="results"
        >{`Results (${totalResults})`}</TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <StacPanelFilters
          filterState={filterState}
          filterSetters={filterSetters}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          useWorldBBox={useWorldBBox}
          setUseWorldBBox={setUseWorldBBox}
        />
      </TabsContent>
      <TabsContent value="results">
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
