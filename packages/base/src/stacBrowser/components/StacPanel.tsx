import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useState } from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import {
  StacResultsProvider,
  useStacResultsContext,
} from '@/src/stacBrowser/context/StacResultsContext';
import StacGenericFilterPanel from './StacGenericFilterPanel';
import StacPanelResults from './StacPanelResults';
import StacGeodesFilterPanel from './geodes/StacGeodesFilterPanel';

interface IStacViewProps {
  model?: IJupyterGISModel;
}

// Inner component that uses the context
const StacPanelContent = ({ model }: IStacViewProps) => {
  const [selectedUrl, setSelectedUrl] = useState<string>(
    'https://stac.dataspace.copernicus.eu/v1/',
  );
  const { totalResults } = useStacResultsContext();

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
          <StacGeodesFilterPanel model={model} />
        ) : (
          <StacGenericFilterPanel model={model} />
        )}
      </TabsContent>
      <TabsContent value="results">
        <StacPanelResults />
      </TabsContent>
    </Tabs>
  );
};

// Outer component that provides the context
const StacPanel = ({ model }: IStacViewProps) => {
  return (
    <StacResultsProvider>
      <StacPanelContent model={model} />
    </StacResultsProvider>
  );
};

export default StacPanel;
