import { IJupyterGISModel } from '@jupytergis/schema';
import React from 'react';

import {
	Select,
	type ISelectItem,
} from '@/src/shared/components/Select';
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

// Provider configuration - in the future this will come from STAC index
interface IProvider {
  url: string;
  name: string;
}

const PROVIDERS: IProvider[] = [
  { url: COPERNICUS_URL, name: 'Copernicus' },
  { url: GEODES_URL, name: 'GEODES' },
  { url: WORLDPOP_URL, name: 'WorldPop' },
];

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
  const { totalResults, selectedUrl } = useStacResultsContext();

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
      <TabsList className="jgis-stac-panel-tabs-list">
        <TabsTrigger className="jGIS-layer-browser-category" value="filters">
          Filters
        </TabsTrigger>
        <TabsTrigger
          className="jGIS-layer-browser-category"
          value="results"
          // Total results will always be the the same as the limit if the
          // provider doesn't support the context extension (where totalPages comes from)
        >
          {`Results (${totalResults})`}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <div className="jgis-stac-filter-extension-panel">
          <StacPanel.ProviderSelect />
          {selectedUrl ? (
            <ProviderPanel model={model} />
          ) : (
            <div className="jgis-stac-panel-placeholder">
              Please select a provider above
            </div>
          )}
        </div>
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

  const selectedProvider = PROVIDERS.find(
    provider => provider.url === selectedUrl,
  );
  const buttonText = selectedProvider?.name || 'Select a provider...';

  const items: ISelectItem[] = PROVIDERS.map(provider => ({
    value: provider.url,
    label: provider.name,
    onSelect: () => setSelectedUrl(provider.url),
  }));

  return (
    <div className="jgis-stac-filter-extension-section">
      <label className="jgis-stac-filter-extension-label">Provider</label>
      <Select
        items={items}
        buttonText={buttonText}
        emptyText="No provider found."
        buttonClassName="jgis-stac-filter-extension-select"
      />
    </div>
  );
}

// Attach ProviderSelect as a composable sub-component
StacPanel.ProviderSelect = ProviderSelect;

export default StacPanel;
