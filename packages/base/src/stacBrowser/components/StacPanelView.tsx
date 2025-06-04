import { IJGISLayer, IJupyterGISModel } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { format, startOfYesterday } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from '../../shared/components/Button';
import Calendar from '../../shared/components/Calendar';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '../../shared/components/Pagination';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../shared/components/Popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../shared/components/Tabs';
import { cn } from '../../shared/components/utils';
import { IStacViewProps } from '../StacBrowser';
import {
  IResultsLinks,
  IStacItem,
  IStacQueryBody,
  IStacSearchResult
} from '../types/types';
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
  const [currentBBox, setCurrentBBox] = useState<
    [number, number, number, number]
  >([0, 0, 0, 0]);
  const [startTime, setStartTime] = useState<Date>();
  const [endTime, setEndTime] = useState<Date>();
  const [isFirstRender, setIsFirstRender] = useState(false);
  const [resultLinks, setResultLinks] = useState<IResultsLinks>();

  useEffect(() => {
    const listenToModel = (
      sender: IJupyterGISModel,
      bBoxIn4326: [number, number, number, number]
    ) => {
      setCurrentBBox(bBoxIn4326);
    };
    model?.updateResolutionSignal.connect(listenToModel);

    return () => {
      model?.updateResolutionSignal.disconnect(listenToModel);
    };
  }, [model]);

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

    // Build query
    // TODO: Move out of effect
    const fetchInEffect = async () => {
      const body: IStacQueryBody = {
        bbox: currentBBox,
        limit: 12,
        page: 5,
        query: {
          latest: {
            eq: true
          },
          dataset: {
            in: selectedDatasets
          },
          end_datetime: {
            gte: endTime
              ? endTime.toISOString()
              : startOfYesterday().toISOString()
          },
          // Only include following attrs in query if there's a selection
          ...(startTime && {
            start_datetime: { lte: startTime.toISOString() }
          }),
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
      if (!result) {
        console.log('no result');
        return;
      }

      const links = result['links'];
      let next;
      let prev;

      links.forEach(link => {
        if (link.rel === 'next') {
          next = link.href;
        }

        if (link.rel === 'prev') {
          prev = link.href;
        }
      });
      // update links for pagination
      setResultLinks({ next: next ?? '', prev: prev ?? '' });

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

  const handleResultClick = async (id: string) => {
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

  // need to fetch the saved link and update results and update link
  const handlePaginationClick = (url: string | undefined) => {
    //fetch new link - want to redo query with new page number
    // update results
    //update resultLinks
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
        {/* Date Picker */}
        <div className="jgis-stac-browser-date-picker">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !startTime && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startTime ? format(startTime, 'PPP') : <span>Start Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startTime}
                onSelect={setStartTime}
                initialFocus
              />
            </PopoverContent>
            the
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  'w-[280px] justify-start text-left font-normal',
                  !endTime && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endTime ? format(endTime, 'PPP') : <span>End Date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endTime}
                onSelect={setEndTime}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
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
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePaginationClick(resultLinks?.prev)}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => handlePaginationClick(resultLinks?.next)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        <div>Results</div>
        <div className="jgis-stac-browser-results-list">
          {results.map(result => (
            <Button
              className="jgis-stac-browser-results-item"
              onClick={() => handleResultClick(result.id)}
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
