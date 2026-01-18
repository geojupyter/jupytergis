import { IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import React from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/src/shared/components/Tabs';
import useGenericStacSearch from '@/src/stacBrowser/hooks/useGenericStacSearch';
import useStacIndex from '@/src/stacBrowser/hooks/useStacIndex';
import useStacSearch from '@/src/stacBrowser/hooks/useStacSearch';
import CollectionBrowser from './CollectionBrowser';
import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';
interface IStacViewProps {
  model?: IJupyterGISModel;
}
const StacPanel = ({ model }: IStacViewProps) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedCatalog, setSelectedCatalog] = React.useState<string>('');
  const [genericCollectionData, setGenericCollectionData] =
    React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState('filters');
  const { catalogs } = useStacIndex(model);
  const geodesSearch = useStacSearch({ model });
  const genericSearch = useGenericStacSearch({
    model,
    collectionUrl: genericCollectionData?.url,
    collectionData: genericCollectionData,
  });
  const isGenericMode = !!selectedCatalog;
  const activeCatalog = catalogs.find(c => c.url === selectedCatalog);
  const catalogTitle = activeCatalog?.title || 'Custom Catalog';
  const handleOpenSelectCatalogDialog = async () => {
    const widget = new URLInputWidget(catalogs);
    inputRef.current = widget.getInput();
    const dialog = new Dialog<boolean>({
      title: 'Select STAC Catalog',
      body: widget,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Select' })],
    });
    const result = await dialog.launch();
    if (result.button.accept && inputRef.current?.value) {
      setSelectedCatalog(inputRef.current.value);
      setGenericCollectionData(null);
      setActiveTab('filters');
    }
  };
  const handleResetCatalog = () => {
    setSelectedCatalog('');
    setGenericCollectionData(null);
    setActiveTab('filters');
  };
  const activeSearch = isGenericMode ? genericSearch : geodesSearch;
  if (!model) {
    return null;
  }
  return (
    <div>
      <div>
        <div>{isGenericMode ? catalogTitle : 'No catalog selected'}</div>
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={
              isGenericMode ? handleResetCatalog : handleOpenSelectCatalogDialog
            }
          >
            {isGenericMode ? 'Reset' : 'Change'}
          </Button>
        </div>
      </div>

      <Tabs
        defaultValue="filters"
        value={activeTab}
        onValueChange={setActiveTab}
        className="jgis-panel-tabs"
      >
        <TabsList style={{ borderRadius: 0 }}>
          <TabsTrigger value="filters" className="jGIS-layer-browser-category">
            {isGenericMode ? 'Browser' : 'Filters'}
          </TabsTrigger>
          <TabsTrigger value="results" className="jGIS-layer-browser-category">
            Results ({activeSearch.totalResults})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="filters">
          {isGenericMode ? (
            <CollectionBrowser
              model={model}
              catalogUrl={selectedCatalog}
              onCollectionSelect={setGenericCollectionData}
            />
          ) : (
            <StacPanelFilters
              filterState={geodesSearch.filterState}
              filterSetters={geodesSearch.filterSetters}
              startTime={geodesSearch.startTime}
              setStartTime={geodesSearch.setStartTime}
              endTime={geodesSearch.endTime}
              setEndTime={geodesSearch.setEndTime}
              useWorldBBox={geodesSearch.useWorldBBox}
              setUseWorldBBox={geodesSearch.setUseWorldBBox}
            />
          )}
        </TabsContent>
        <TabsContent value="results">
          {isGenericMode && !genericCollectionData ? (
            <div>
              <span>No Collection Selected</span>
              <span>
                Please go to the <strong>Browser</strong> tab and select a
                dataset to view items.
              </span>
            </div>
          ) : (
            <StacPanelResults
              results={activeSearch.results}
              currentPage={activeSearch.currentPage}
              totalPages={activeSearch.totalPages}
              handlePaginationClick={activeSearch.handlePaginationClick}
              handleResultClick={activeSearch.handleResultClick}
              formatResult={activeSearch.formatResult}
              isLoading={activeSearch.isLoading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default StacPanel;

class URLInputWidget extends Widget {
  private input: HTMLInputElement;
  constructor(catalogs: any[] = []) {
    const node = document.createElement('div');
    node.style.padding = '20px';
    node.style.minWidth = '400px';
    const header = document.createElement('div');
    header.textContent = 'Connect to a STAC Catalog';
    header.style.fontSize = '14px';
    header.style.fontWeight = '600';
    header.style.marginBottom = '16px';
    header.style.color = '#111827';
    const label = document.createElement('label');
    label.textContent = 'Catalog URL';
    label.style.display = 'block';
    label.style.fontSize = '13px';
    label.style.fontWeight = '500';
    label.style.marginBottom = '6px';
    label.style.color = '#374151';
    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'https://example.com/stac/catalog.json';
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.border = '1px solid #d1d5db';
    input.style.borderRadius = '6px';
    input.style.marginBottom = '16px';
    input.style.boxSizing = 'border-box';
    input.style.fontSize = '13px';
    input.style.fontFamily = 'inherit';
    const catalogLabel = document.createElement('label');
    catalogLabel.textContent = 'Or select from recommended catalogs';
    catalogLabel.style.display = 'block';
    catalogLabel.style.fontSize = '13px';
    catalogLabel.style.fontWeight = '500';
    catalogLabel.style.marginBottom = '6px';
    catalogLabel.style.color = '#374151';
    const dropdown = document.createElement('select');
    dropdown.style.width = '100%';
    dropdown.style.padding = '8px 12px';
    dropdown.style.border = '1px solid #d1d5db';
    dropdown.style.borderRadius = '6px';
    dropdown.style.backgroundColor = '#fff';
    dropdown.style.boxSizing = 'border-box';
    dropdown.style.fontSize = '13px';
    dropdown.style.fontFamily = 'inherit';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a catalog --';
    dropdown.appendChild(defaultOption);
    catalogs.forEach((catalog: any) => {
      const option = document.createElement('option');
      option.value = catalog.url;
      option.textContent = catalog.title;
      dropdown.appendChild(option);
    });
    dropdown.addEventListener('change', e => {
      const val = (e.target as HTMLSelectElement).value;
      if (val) {
        input.value = val;
      }
    });
    node.appendChild(header);
    node.appendChild(label);
    node.appendChild(input);
    node.appendChild(catalogLabel);
    node.appendChild(dropdown);
    super({ node });
    this.input = input;
  }
  getInput() {
    return this.input;
  }
}
