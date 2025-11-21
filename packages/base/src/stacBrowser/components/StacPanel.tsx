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

interface IStacViewProps {
  model?: IJupyterGISModel;
}
const StacPanel = ({ model }: IStacViewProps) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const { catalogs } = useStacIndex(model);

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

  const handleOpenDialog = async () => {
    const widget = new URLInputWidget(catalogs);
    inputRef.current = widget.getInput();

    const dialog = new Dialog<boolean>({
      title: 'Add Catalog',
      body: widget,
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Add' })],
    });

    const result = await dialog.launch();
    if (result.button.accept && inputRef.current) {
      const url = inputRef.current.value;
      console.log('Catalog URL added:', url);
    }
  };

  return (
    <div className="Select Catalog">
      <Button onClick={handleOpenDialog}>Select a Catalog</Button>

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
    </div>
  );
};

export default StacPanel;

class URLInputWidget extends Widget {
  private input: HTMLInputElement;
  private catalogInput: HTMLInputElement;

  constructor(catalogs: any[] = []) {
    const node = document.createElement('div');
    node.style.padding = '10px';

    // First section: Manual URL entry
    const label = document.createElement('label');
    label.textContent = 'Enter Catalog URL:';
    label.style.display = 'block';
    label.style.marginBottom = '8px';
    label.style.fontWeight = 'bold';

    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'https://example.com';
    input.className = 'jgis-stac-url-input';

    // Second section: Select from catalog dropdown
    const catalogLabel = document.createElement('label');
    catalogLabel.textContent = 'Or select a catalog:';
    catalogLabel.style.display = 'block';
    catalogLabel.style.marginBottom = '8px';
    catalogLabel.style.fontWeight = 'bold';

    const dropdown = document.createElement('select');
    dropdown.style.width = '100%';
    dropdown.style.padding = '8px';
    dropdown.style.boxSizing = 'border-box';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '4px';
    dropdown.style.marginBottom = '10px';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a catalog...';
    dropdown.appendChild(defaultOption);

    catalogs.forEach((catalog: any) => {
      const option = document.createElement('option');
      option.value = catalog.url;
      option.textContent = catalog.title;
      dropdown.appendChild(option);
    });

    const catalogInputLabel = document.createElement('label');
    catalogInputLabel.textContent = 'Selected Catalog URL:';
    catalogInputLabel.style.display = 'block';
    catalogInputLabel.style.marginBottom = '8px';
    catalogInputLabel.className = 'jgis-stac-catalog-input-label';

    const catalogInput = document.createElement('input');
    catalogInput.type = 'url';
    catalogInput.placeholder = 'Selected catalog URL will appear here';
    catalogInput.className = 'jgis-stac-catalog-input';
    catalogInput.readOnly = true;

    dropdown.addEventListener('change', e => {
      const selectedUrl = (e.target as HTMLSelectElement).value;
      catalogInput.value = selectedUrl;
    });

    node.appendChild(label);
    node.appendChild(input);
    node.appendChild(catalogLabel);
    node.appendChild(dropdown);
    node.appendChild(catalogInputLabel);
    node.appendChild(catalogInput);

    super({ node });
    this.input = input;
    this.catalogInput = catalogInput;
  }

  getInput(): HTMLInputElement {
    return this.input.value ? this.input : this.catalogInput;
  }
}
