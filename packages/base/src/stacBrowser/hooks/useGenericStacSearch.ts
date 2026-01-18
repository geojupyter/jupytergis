import { IJupyterGISModel, IJGISLayer } from '@jupytergis/schema';
import { UUID } from '@lumino/coreutils';
import { useEffect, useState } from 'react';


import { fetchWithProxies } from '@/src/tools';
import { IStacItem } from '../types/types';

interface IUseGenericStacSearchProps {
  model: IJupyterGISModel | undefined;
  collectionUrl?: string;
  collectionData?: any;
}

export const useGenericStacSearch = ({
  model,
  collectionUrl,
  collectionData,
}: IUseGenericStacSearchProps) => {
  const [results, setResults] = useState<IStacItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Reset when collection changes
  useEffect(() => {
    setResults([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalResults(0);
    setError(null);
  }, [collectionUrl]);

  useEffect(() => {
    if (!model || !collectionUrl || !collectionData) {
      return;
    }

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        // Strategy:
        // 1. Check for 'items' link (OGC API Features / STAC API)
        // 2. Fallback to crawling 'item' links in the collection itself (Static STAC)

        const itemsLink = collectionData.links?.find(
          (l: any) => l.rel === 'items',
        );

        let data: any;

        if (itemsLink) {
          // Case A: API-based Collection
          const itemsUrl = new URL(itemsLink.href, collectionUrl).toString();
          // Append standard OGC query params
          const separator = itemsUrl.includes('?') ? '&' : '?';
          const urlWithParams = `${itemsUrl}${separator}limit=12&page=${currentPage}`;

          data = await fetchWithProxies(urlWithParams, model, async r =>
            r.json(),
          );
        } else {
          // Case B: Static Catalog Collection (links to items directly)
          const itemLinks = collectionData.links.filter(
            (l: any) => l.rel === 'item',
          );

          if (itemLinks.length > 0) {
            const start = (currentPage - 1) * 12;
            const end = start + 12;
            const pageLinks = itemLinks.slice(start, end);

            const promises = pageLinks.map(async (link: any) => {
              const itemUrl = new URL(link.href, collectionUrl).toString();
              return fetchWithProxies(itemUrl, model, async r => r.json());
            });
            const items = await Promise.all(promises);

            // Construct a fake FeatureCollection response
            data = {
              features: items,
              context: { matched: itemLinks.length, limit: 12 },
            };
          } else {
            data = { features: [] };
          }
        }

        if (data && data.features) {
          setResults(data.features);
          const matched =
            data.context?.matched || data.numberMatched || data.features.length;
          const limit = data.context?.limit || 12;
          setTotalResults(matched);
          setTotalPages(Math.ceil(matched / limit));
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Error fetching generic STAC items:', err);
        setError('Failed to fetch items.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [model, collectionUrl, collectionData, currentPage]);

  const handleResultClick = async (id: string) => {
    const item = results.find(r => r.id === id);
    if (!item || !model) {
      return;
    }

    const layerId = UUID.uuid4();
    const layerModel: IJGISLayer = {
      type: 'StacLayer',
      parameters: { data: item },
      visible: true,
      name: item.properties?.title || item.id,
    };

    model.addLayer(layerId, layerModel);
  };

  const handlePaginationClick = async (page: number) => {
    setCurrentPage(page);
  };

  const formatResult = (item: IStacItem) => item.properties?.title || item.id;

  return {
    results,
    isLoading,
    error,
    totalPages,
    currentPage,
    totalResults,
    handleResultClick,
    handlePaginationClick,
    formatResult,
  };
};

export default useGenericStacSearch;
