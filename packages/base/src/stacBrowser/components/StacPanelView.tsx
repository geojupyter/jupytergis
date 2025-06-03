import { IJGISLayer } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import React, { useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../shared/components/Tabs';
import { IStacViewProps } from '../StacBrowser';
import { IStacItem, IStacQueryBody, IStacSearchResult } from '../types/types';
import ProductSection from './ProductSection';
import StacFilterSection from './StacFilterSection';

const apiUrl = 'https://geodes-portal.cnes.fr/api/stac/search';

const StacPanelView = ({
  datasets,
  platforms,
  model,
  products,
  displayInfo,
  handleCategoryClick,
  handleSearchInput,
  searchTerm,
  selectedCategory
}: IStacViewProps) => {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [results, setResults] = useState<IStacItem[]>([]);

  useEffect(() => {
    console.log('selectedCollections', selectedCollections);
  }, [selectedCollections]);

  const [isFirstRender, setIsFirstRender] = useState(false);

  useEffect(() => {
    // Geodes behavior => query on every selection
    const selectedDatasets = Object.entries(datasets)
      .filter(([key]) => selectedCollections.includes(key))
      .flatMap(([_, values]) => values);

    const processingLevel: string[] = [];
    const productType: string[] = [];

    selectedProducts.forEach(productCode => {
      productType.push(...products[productCode]['product:type']);

      // No processing:level for some collections
      if (products[productCode]['processing:level']) {
        processingLevel.push(...products[productCode]['processing:level']);
      }
    });

    console.log('selectedProducts', selectedProducts);

    console.log('selectedProducts.flat()', selectedProducts.flat());

    console.log('processingLevel', processingLevel);
    console.log('processingLevel.flat()', processingLevel.flat());
    console.log('productType', productType);
    console.log('productType.flat()', productType.flat());
    // Build query
    // TODO: Move out of fetch
    const fetchInEffect = async () => {
      // so i have the list of keys, now i need to look em up

      // TODO: All the hardcoded stuff
      const body: IStacQueryBody = {
        // TODO: get this from model
        bbox: [-180, -65.76350697055292, 180, 65.76350697055292],
        limit: 12,
        page: 1,
        query: {
          dataset: {
            in: selectedDatasets
          },
          end_datetime: {
            gte: '2025-05-27T09:21:00.000Z'
          },
          latest: {
            eq: true
          },
          // Only include following attrs in query if there's a selection
          ...(selectedPlatforms.length > 0 && {
            platform: { in: selectedPlatforms }
          }),
          ...(processingLevel.length > 0 && {
            'processing:level': { in: processingLevel }
          }),
          ...(productType.length > 0 && {
            'product:type': { in: productType }
          })
        },
        sortBy: [
          {
            direction: 'desc',
            field: 'start_datetime'
          }
        ]
      };

      console.log('body', body);

      // TODO: Don't call this on render.
      const result = await fetchWithProxy(body); // this result is ItemCollection
      console.log('result', result);
    };

    // TODO: Do this better. Really don't use an effect
    if (!isFirstRender) {
      fetchInEffect();
    }

    if (isFirstRender) {
      setIsFirstRender(false);
    }
  }, [selectedCollections, selectedPlatforms, selectedProducts]);

  async function fetchWithProxy(options: IStacQueryBody) {
    // Needed for POST
    const xsrfToken = document.cookie.match(/_xsrf=([^;]+)/)?.[1];

    const proxyUrl = `/jupytergis_core/proxy?url=${encodeURIComponent(apiUrl)}`;

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        //@ts-expect-error Jupyter requires X-XSRFToken header
        headers: {
          'Content-Type': 'application/json',
          'X-XSRFToken': xsrfToken,
          credentials: 'include'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as IStacSearchResult;

      setResults(data.features);
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleTileClick = async (id: string) => {
    console.log('id', id);
    if (!results) {
      return;
    }

    const layerId = UUID.uuid4();

    const stacData = results.find(item => item.id === id);

    console.log('stacData', stacData);
    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: {
        data: stacData
      },
      visible: true,
      name: 'STAC Layer'
    };

    model ? model.addLayer(layerId, layerModel) : console.log('no model');
  };

  // TODO: ??? idk this won't work for most (?) things
  const formatResult = (item: IStacItem): string => {
    // Find the first asset with a 'data' role
    const dataAsset = Object.values(item.assets).find(val =>
      val.roles?.includes('data')
    );

    // Return title without extension if found, otherwise item.id
    return dataAsset ? dataAsset.title.split('.')[0] : item.id;
  };

  if (!model) {
    return;
  }

  return (
    <Tabs defaultValue="filters" className="jgis-stac-browser-main">
      <TabsList>
        <TabsTrigger value="filters">Filters</TabsTrigger>
        <TabsTrigger value="results">{`Results (${results.length})`}</TabsTrigger>
      </TabsList>
      <TabsContent value="filters">
        <div>save/load filter</div>
        <div>date time picker</div>
        <div>where</div>
        <StacFilterSection
          header="Collection"
          data={datasets}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('collections', val);
            setSelectedCollections(val);
          }}
          selectedPlatforms={selectedPlatforms}
          model={model}
        />
        <StacFilterSection
          header="Platform"
          data={platforms}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('plaforms', val);
            setSelectedPlatforms(val);
          }}
          selectedPlatforms={selectedPlatforms}
          model={model}
        />
        <ProductSection
          header="Data / Product"
          data={products}
          selectedCollections={selectedCollections}
          handleToggleGroupValueChange={(val: string[]) => {
            console.log('products', val);
            setSelectedProducts(val);
          }}
          selectedProducts={selectedProducts}
          model={model}
        />
        <div>cloud cover</div>
      </TabsContent>
      <TabsContent value="results">
        <div>Results</div>
        <div className="jgis-stac-browser-results-list">
          {results.map(result => (
            <Button
              className="jgis-stac-browser-results-item"
              onClick={() => handleTileClick(result.id)}
            >
              {formatResult(result)}
            </Button>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default StacPanelView;
