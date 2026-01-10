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
import useStacIndex from '@/src/stacBrowser/hooks/useStacIndex';
import useStacSearch from '@/src/stacBrowser/hooks/useStacSearch';
import StacPanelFilters from './StacPanelFilters';
import StacPanelResults from './StacPanelResults';
import CollectionBrowser from './CollectionBrowser';
import useGenericStacSearch from '@/src/stacBrowser/hooks/useGenericStacSearch';
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
  const handleOpenDialog = async () => {
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
  const activeResults = isGenericMode
    ? genericSearch.results
    : geodesSearch.results;
  const activeTotalResults = isGenericMode
    ? genericSearch.totalResults
    : geodesSearch.totalResults;
  const activeIsLoading = isGenericMode
    ? genericSearch.isLoading
    : geodesSearch.isLoading;
  const activePagination = isGenericMode
    ? genericSearch.handlePaginationClick
    : geodesSearch.handlePaginationClick;
  const activeResultClick = isGenericMode
    ? genericSearch.handleResultClick
    : geodesSearch.handleResultClick;
  const activeFormat = isGenericMode
    ? genericSearch.formatResult
    : geodesSearch.formatResult;
  const activeCurrentPage = isGenericMode
    ? genericSearch.currentPage
    : geodesSearch.currentPage;
  const activeTotalPages = isGenericMode
    ? genericSearch.totalPages
    : geodesSearch.totalPages;
  if (!model) return null;
  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Catalog Header */}
      <div className="flex-none px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="text-xs font-semibold text-gray-700 mb-1">
          {/* CHANGED: Default title to "No catalog selected" */}
          {isGenericMode ? catalogTitle : 'No catalog selected'}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-xs text-gray-500 truncate">
            {/* Description removed for default state */}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={isGenericMode ? handleResetCatalog : handleOpenDialog}
            className="text-xs h-7 px-2 bg-white"
          >
            {isGenericMode ? 'Reset' : 'Change'}
          </Button>
        </div>
      </div>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="w-full grid grid-cols-2 mb-2 px-2 mt-2">
          <TabsTrigger value="filters" className="text-xs">
            {isGenericMode ? 'Browser' : 'Filters'}
          </TabsTrigger>
          <TabsTrigger value="results" className="text-xs">
            Results ({activeTotalResults})
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="filters"
          className="flex-1 overflow-hidden flex flex-col h-full px-2"
        >
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
        <TabsContent
          value="results"
          className="flex-1 overflow-y-auto h-full px-2"
        >
          {isGenericMode && !genericCollectionData ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 italic text-center border-2 border-dashed border-gray-100 rounded m-2">
              <span className="mb-2 font-semibold">No Collection Selected</span>
              <span className="text-xs px-4">
                Please go to the <strong>Browser</strong> tab and select a
                dataset to view items.
              </span>
            </div>
          ) : (
            <StacPanelResults
              results={activeResults}
              currentPage={activeCurrentPage}
              totalPages={activeTotalPages}
              handlePaginationClick={activePagination}
              handleResultClick={activeResultClick}
              formatResult={activeFormat}
              isLoading={activeIsLoading}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default StacPanel;
// --- URL Input Widget for Dialog ---
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
      if (val) input.value = val;
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
