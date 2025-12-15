import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import StacFilterExtensionPanel from '@/src/stacBrowser/components/filter-extension/StacFilterExtensionPanel';
import StacGeodesFilterPanel from '@/src/stacBrowser/components/geodes/StacGeodesFilterPanel';
import StacPanelResults from '@/src/stacBrowser/components/shared/StacPanelResults';
import {
  StacResultsProvider,
  useStacResultsContext,
} from '@/src/stacBrowser/context/StacResultsContext';

const GEODES_URL = 'https://geodes-portal.cnes.fr/api/stac/';
const COPERNICUS_URL = 'https://stac.dataspace.copernicus.eu/v1/';
const WORLDPOP_URL = 'https://api.stac.worldpop.org/';

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
  const { totalResults, selectedUrl, totalPages } = useStacResultsContext();

  if (!model) {
    return null;
  }

  const ProviderPanel =
    URL_TO_PANEL_MAP[selectedUrl] ?? StacFilterExtensionPanel;

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
          // Total results will always be the the same as the limit if the
          // provider doesn't support the context extension (where totalPages comes from)
        >
          {totalPages === 1 ? 'Results' : `Results (${totalResults})`}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <StacPanel.ProviderSelect />
        {selectedUrl ? (
          <ProviderPanel model={model} />
        ) : (
          <div
            style={{
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--jp-ui-font-color2)',
            }}
          >
            Please select a provider above
          </div>
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
    <StacResultsProvider model={model}>
      <StacPanelContent model={model} />
    </StacResultsProvider>
  );
};

/**
 * Provider selector component for choosing STAC providers.
 * Uses context to manage selected provider URL.
 */
function ProviderSelect() {
  const { selectedUrl, setSelectedUrl } = useStacResultsContext();

  return (
    <div style={{ margin: '0 1rem 1rem 1rem' }}>
      <select
        style={{ width: '100%', padding: '0.5rem' }}
        value={selectedUrl}
        onChange={e => setSelectedUrl(e.target.value)}
      >
        <option value="" disabled>
          Select a provider...
        </option>
        <option value={COPERNICUS_URL}>Copernicus</option>
        <option value={GEODES_URL}>GEODES</option>
        <option value={WORLDPOP_URL}>WorldPop</option>
      </select>
    </div>
  );
}

// Attach ProviderSelect as a composable sub-component
StacPanel.ProviderSelect = ProviderSelect;

export default StacPanel;
