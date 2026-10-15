import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import { HYDROWEB_STAC_URL } from '@/src/features/stac-browser/catalogQuery';
import StacCatalogQueryPanel from '@/src/features/stac-browser/components/catalog-query/StacCatalogQueryPanel';
import StacWmsCollectionResult from '@/src/features/stac-browser/components/catalog-query/StacWmsCollectionResult';
import StacFilterExtensionPanel from '@/src/features/stac-browser/components/filter-extension/StacFilterExtensionPanel';
import StacGeodesFilterPanel from '@/src/features/stac-browser/components/geodes/StacGeodesFilterPanel';
import StacPanelResults from '@/src/features/stac-browser/components/shared/StacPanelResults';
import {
  StacResultsProvider,
  useStacResultsContext,
} from '@/src/features/stac-browser/context/StacResultsContext';
import { Input } from '@/src/shared/components/Input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/src/shared/components/NativeSelect';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';

const GEODES_URL = 'https://geodes-portal.cnes.fr/api/stac/';
const COPERNICUS_URL = 'https://stac.dataspace.copernicus.eu/v1/';
const WORLDPOP_URL = 'https://api.stac.worldpop.org/';
const CATALOG_URL_PRESET = 'custom';

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
  [COPERNICUS_URL]: StacFilterExtensionPanel,
  [WORLDPOP_URL]: StacFilterExtensionPanel,
};

interface IStacViewProps {
  model?: IJupyterGISModel;
}

// Inner component that uses the context
const StacPanelContent = ({ model }: IStacViewProps) => {
  const { totalResults, isLoading, selectedUrl, wmsCollection } =
    useStacResultsContext();

  if (!model) {
    return null;
  }

  const ProviderPanel = URL_TO_PANEL_MAP[selectedUrl] ?? StacCatalogQueryPanel;

  return (
    <Tabs defaultValue="filters" style={{ boxShadow: 'none' }}>
      <TabsList variant="underline" className="jgis-stac-panel-tabs-list">
        <TabsTrigger
          className="jgis-underline-indicator text-sm"
          value="filters"
        >
          Filters
        </TabsTrigger>
        <TabsTrigger className="jgis-underline-indicator" value="results">
          {resultsTabLabel(isLoading, Boolean(wmsCollection), totalResults)}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <div className="jgis-stac-filter-extension-panel">
          <CatalogUrlField />
          <StacPanel.ProviderSelect />
          {selectedUrl ? (
            <ProviderPanel model={model} />
          ) : (
            <div className="jgis-stac-panel-placeholder">
              Enter a catalog URL above
            </div>
          )}
        </div>
      </TabsContent>
      <TabsContent value="results">
        {wmsCollection ? (
          <StacWmsCollectionResult model={model} />
        ) : (
          <StacPanelResults />
        )}
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

function resultsTabLabel(
  isLoading: boolean,
  hasWmsCollection: boolean,
  totalResults: string,
): string {
  if (hasWmsCollection) {
    return 'Results (1)';
  }

  if (isLoading) {
    return 'Results (...)';
  }

  return `Results (${totalResults})`;
}

function CatalogUrlField() {
  const { selectedUrl, setSelectedUrl } = useStacResultsContext();
  const [urlDraft, setUrlDraft] = useState(selectedUrl);

  useEffect(() => {
    setUrlDraft(selectedUrl);
  }, [selectedUrl]);

  const commitUrl = () => {
    const next = urlDraft.trim();
    if (next !== selectedUrl) {
      setSelectedUrl(next);
    }
  };

  return (
    <div className="jgis-stac-filter-extension-section">
      <label className="jgis-stac-filter-extension-label">Catalog URL</label>
      <Input
        value={urlDraft}
        spellCheck={false}
        placeholder={HYDROWEB_STAC_URL}
        onChange={event => {
          setUrlDraft(event.target.value);
        }}
        onBlur={commitUrl}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commitUrl();
          }
        }}
      />
    </div>
  );
}

function ProviderSelect() {
  const { selectedUrl, setSelectedUrl } = useStacResultsContext();
  const isPreset = PROVIDERS.some(provider => provider.url === selectedUrl);

  return (
    <div className="jgis-stac-filter-extension-section">
      <label className="jgis-stac-filter-extension-label">Provider</label>
      <NativeSelect
        className="w-full"
        value={isPreset ? selectedUrl : CATALOG_URL_PRESET}
        onChange={event => {
          const next = event.target.value;
          if (next === CATALOG_URL_PRESET) {
            if (isPreset) {
              setSelectedUrl(HYDROWEB_STAC_URL);
            }
            return;
          }
          setSelectedUrl(next);
        }}
      >
        <NativeSelectOption value={CATALOG_URL_PRESET}>
          Catalog URL
        </NativeSelectOption>
        {PROVIDERS.map(provider => (
          <NativeSelectOption key={provider.url} value={provider.url}>
            {provider.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

// Attach ProviderSelect as a composable sub-component
StacPanel.ProviderSelect = ProviderSelect;

export default StacPanel;
