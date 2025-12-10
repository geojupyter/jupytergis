import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

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

const GEODES_URL = 'https://geodes-portal.cnes.fr/api/stac/';

// URL to panel component mapping for extensibility
// Add new entries here to support additional STAC providers
const URL_TO_PANEL_MAP: Record<
  string,
  React.ComponentType<{ model?: IJupyterGISModel }>
> = {
  [GEODES_URL]: StacGeodesFilterPanel,
};

interface IStacViewProps {
  model?: IJupyterGISModel;
}

// Inner component that uses the context
const StacPanelContent = ({ model }: IStacViewProps) => {
  const { totalResults, selectedUrl, setSelectedUrl } = useStacResultsContext();

  if (!model) {
    return null;
  }

  const PanelComponent =
    URL_TO_PANEL_MAP[selectedUrl] ?? StacGenericFilterPanel;

  return (
    <Tabs
      defaultValue="filters"
      className="jgis-panel-tabs"
      style={{ boxShadow: 'none' }}
    >
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
            <option value={GEODES_URL}>GEODES</option>
            <option value="https://api.stac.worldpop.org/">WorldPop</option>
          </select>
        </div>

        <PanelComponent model={model} />
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
    <StacResultsProvider model={model}>
      <StacPanelContent model={model} />
    </StacResultsProvider>
  );
};

export default StacPanel;
