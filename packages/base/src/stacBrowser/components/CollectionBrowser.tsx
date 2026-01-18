import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { IJupyterGISModel } from '@jupytergis/schema';
import { Button } from '@/src/shared/components/Button';
import { LoadingIcon } from '@/src/shared/components/loading';
import { fetchWithProxies } from '@/src/tools';

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
    if (!model || !currentUrl) {
      return;
    }
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
    if (currentNode && (
      currentNode.type === 'Collection'
      || currentNode.links.some(l => l.rel === 'item' || l.rel === 'items')
    )) {
      onCollectionSelect({ ...currentNode, url: currentUrl });
    }
  }, [currentNode, currentUrl, onCollectionSelect]);


  const handleNavigate = (link: IStacLink) => {
    const targetUrl = new URL(link.href, currentUrl).toString();
    const title = currentNode?.title || currentNode?.id || 'Catalog';
    setHistory(prev => [...prev, { url: currentUrl, title }]);
    setCurrentUrl(targetUrl);
  };

  const handleBack = () => {
    if (history.length === 0) {
      return;
    }
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setCurrentUrl(previous.url);
  };

  if (isLoading) {
    return (
      <div>
        <LoadingIcon size="lg" />
      </div>
    );
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!currentNode) {
    return null;
  }

  const children = currentNode.links.filter(
    link =>
      link.rel === 'child' || link.rel === 'collection' || link.rel === 'data',
  );

  return (
    <div>
      <div>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            title="Go Back"
          >
            <ArrowLeft size={14} />
          </Button>
        )}
        <div>
          <span>Collection:</span>
          {history.map((h, i) => (
            <span key={i}>
              {h.title} &gt;{' '}
            </span>
          ))}
          <span>
            {currentNode.title || currentNode.id}
          </span>
        </div>
      </div>


      <div>
        {children.length > 0 ? (
          <>
            <label>
              Navigate to Sub-collection:
            </label>
            <select
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
          <div>
            No sub-collections found
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionBrowser;
