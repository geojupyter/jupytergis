import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import useStacSearch from '@/src/stacBrowser/hooks/useStacSearch';
import StacGenericFilterPanel from './StacGenericFilterPanel';
import StacPanelResults from './StacPanelResults';
import StacGeodesFilterPanel from './geodes/StacGeodesFilterPanel';

interface IStacViewProps {
  model?: IJupyterGISModel;
}
const StacPanel = ({ model }: IStacViewProps) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(
    'https://stac.dataspace.copernicus.eu/v1/',
  );

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
        <div style={{ marginBottom: '1rem' }}>
          <select
            style={{ width: '100%', padding: '0.5rem' }}
            value={selectedUrl}
            onChange={e => setSelectedUrl(e.target.value)}
          >
            <option value="https://stac.dataspace.copernicus.eu/v1/">
              Copernicus
            </option>
            <option value="https://geodes-portal.cnes.fr/api/stac/search">
              GEODES
            </option>
          </select>
        </div>

        {selectedUrl === 'https://geodes-portal.cnes.fr/api/stac/search' ? (
          <StacGeodesFilterPanel
            filterState={filterState}
            filterSetters={filterSetters}
            startTime={startTime}
            setStartTime={setStartTime}
            endTime={endTime}
            setEndTime={setEndTime}
            useWorldBBox={useWorldBBox}
            setUseWorldBBox={setUseWorldBBox}
          />
        ) : (
          <StacGenericFilterPanel model={model} />
        )}
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

export default StacPanel;
