import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { Button } from '@/src/shared/components/Button';
import { LoadingIcon } from '@/src/shared/components/loading';
import { fetchWithProxies } from '@/src/tools';
import { ArrowLeft } from 'lucide-react';

interface ICollectionBrowserProps {
  model?: IJupyterGISModel;
  catalogUrl: string;
  onCollectionSelect: (collection: any) => void;
}

interface IStacLink {
  rel: string;
  href: string;
  title?: string;
  type?: string;
}

interface IStacNode {
  id: string;
  title?: string;
  description?: string;
  links: IStacLink[];
  type?: 'Catalog' | 'Collection';
}

const CollectionBrowser = ({
  model,
  catalogUrl,
  onCollectionSelect,
}: ICollectionBrowserProps) => {
  const [history, setHistory] = useState<{ url: string; title: string }[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string>(catalogUrl);
  const [currentNode, setCurrentNode] = useState<IStacNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUrl(catalogUrl);
    setHistory([]);
    setCurrentNode(null);
  }, [catalogUrl]);

  useEffect(() => {
    if (!model || !currentUrl) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchWithProxies(currentUrl, model, async r =>
          r.json(),
        );
        setCurrentNode(data);
      } catch (err) {
        console.error('Failed to fetch STAC node:', err);
        setError('Failed to load catalog.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [model, currentUrl]);

  useEffect(() => {
    if (currentNode && isCollection(currentNode)) {
      onCollectionSelect({ ...currentNode, url: currentUrl });
    }
  }, [currentNode, currentUrl, onCollectionSelect]);

  const isCollection = (node: IStacNode) => {
    if (node.type === 'Collection') return true;
    if (node.links.some(l => l.rel === 'item' || l.rel === 'items'))
      return true;
    return false;
  };

  const handleNavigate = (link: IStacLink) => {
    const targetUrl = new URL(link.href, currentUrl).toString();
    const title = currentNode?.title || currentNode?.id || 'Catalog';
    setHistory(prev => [...prev, { url: currentUrl, title }]);
    setCurrentUrl(targetUrl);
  };

  const handleBack = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentUrl(previous.url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIcon size="lg" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500 text-sm">{error}</div>;
  }

  if (!currentNode) return null;

  const children = currentNode.links.filter(
    link =>
      link.rel === 'child' || link.rel === 'collection' || link.rel === 'data',
  );

  return (
    <div className="flex flex-col gap-4 p-1">
      {/* Breadcrumb Header */}
      <div className="flex items-start gap-2 pb-2 border-b border-gray-100">
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-6 w-6 mt-0.5 text-gray-500 hover:text-gray-900 shrink-0"
            title="Go Back"
          >
            <ArrowLeft size={14} />
          </Button>
        )}
        <div className="text-xs leading-5 text-gray-700 break-words w-full">
          <span className="font-semibold text-gray-500 mr-1">Collection:</span>
          {history.map((h, i) => (
            <span key={i} className="text-gray-500">
              {h.title} &gt;{' '}
            </span>
          ))}
          <span className="font-semibold text-gray-900">
            {currentNode.title || currentNode.id}
          </span>
        </div>
      </div>

      {/* Description REMOVED per request */}

      {/* Sub-collection Selector or "No sub-collections" text */}
      <div className="flex flex-col gap-2">
        {children.length > 0 ? (
          <>
            <label className="text-xs font-medium text-gray-700">
              Navigate to Sub-collection:
            </label>
            <select
              className="w-full h-9 px-2 py-1 bg-white border border-gray-300 rounded text-xs text-gray-700 focus:outline-none focus:border-blue-500"
              onChange={e => {
                const index = parseInt(e.target.value, 10);
                if (!isNaN(index) && children[index]) {
                  handleNavigate(children[index]);
                }
              }}
              value=""
            >
              <option value="" disabled>
                Select option...
              </option>
              {children.map((link, idx) => (
                <option key={idx} value={idx}>
                  {link.title || link.href.split('/').pop()}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="text-xs text-gray-500 italic mt-2">
            No sub-collections found
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionBrowser;
