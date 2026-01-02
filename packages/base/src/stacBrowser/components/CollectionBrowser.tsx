import { IJupyterGISModel } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';
import { Button } from '@/src/shared/components/Button';
import { LoadingIcon } from '@/src/shared/components/loading';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/src/shared/components/DropdownMenu';
import { fetchWithProxies } from '@/src/tools';
import { ChevronDown, Folder, Layers } from 'lucide-react';

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
  type?: string;
}

// --- Recursive Menu Item Component ---
interface IStacMenuItemProps {
  link: IStacLink;
  baseUrl: string;
  model: IJupyterGISModel;
  onSelect: (node: IStacNode, url: string) => void;
  depth?: number;
}

const StacMenuItem = ({
  link,
  baseUrl,
  model,
  onSelect,
  depth = 0,
}: IStacMenuItemProps) => {
  const [node, setNode] = useState<IStacNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const targetUrl = new URL(link.href, baseUrl).toString();
  const title = link.title || link.href.split('/').pop() || 'Untitled';
  const isCollectionLink = link.rel === 'collection';

  const handleInteraction = async () => {
    if (hasFetched || loading) return;
    setLoading(true);
    try {
      const data = await fetchWithProxies(targetUrl, model, async r =>
        r.json(),
      );
      setNode(data);
    } catch (err) {
      console.error('Failed to load sub-node', err);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  };

  const getChildren = (n: IStacNode) => {
    return n.links.filter(
      l => l.rel === 'child' || l.rel === 'collection' || l.rel === 'data',
    );
  };

  const children = node ? getChildren(node) : [];
  const hasChildren = children.length > 0;

  // If this is a collection or has no children, make it selectable
  const isSelectable = isCollectionLink || (node && !hasChildren);

  if (isSelectable && node) {
    return (
      <DropdownMenuItem
        onClick={e => {
          e.stopPropagation();
          onSelect(node, targetUrl);
        }}
        onPointerEnter={!hasFetched ? handleInteraction : undefined}
      >
        <span className="flex items-center gap-2 text-sm">
          <Layers size={14} className="text-blue-600" />
          {title}
        </span>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onPointerEnter={handleInteraction}
        onFocus={handleInteraction}
      >
        <span className="flex items-center gap-2 text-sm">
          <Folder size={14} />
          {title}
        </span>
      </DropdownMenuSubTrigger>

      <DropdownMenuSubContent className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <DropdownMenuItem disabled>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <LoadingIcon size="xs" /> Loading...
            </span>
          </DropdownMenuItem>
        ) : node && hasChildren ? (
          <>
            {children.map((childLink, idx) => (
              <StacMenuItem
                key={idx}
                link={childLink}
                baseUrl={targetUrl}
                model={model}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
          </>
        ) : node && !hasChildren ? (
          <DropdownMenuItem
            onClick={e => {
              e.stopPropagation();
              onSelect(node, targetUrl);
            }}
          >
            <span className="flex items-center gap-2 text-sm">
              <Layers size={14} className="text-blue-600" />
              Select this catalog
            </span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <span className="text-xs text-red-600">Failed to load</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

// --- Main Browser Component ---
const CollectionBrowser = ({
  model,
  catalogUrl,
  onCollectionSelect,
}: ICollectionBrowserProps) => {
  const [rootNode, setRootNode] = useState<IStacNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');

  useEffect(() => {
    const fetchRoot = async () => {
      if (!model || !catalogUrl) return;
      setLoading(true);
      setError(null);
      setSelectedTitle('');

      try {
        const data = await fetchWithProxies(catalogUrl, model, async r =>
          r.json(),
        );
        setRootNode(data);
      } catch (err) {
        console.error('Failed to fetch root catalog:', err);
        setError('Failed to load catalog');
      } finally {
        setLoading(false);
      }
    };
    fetchRoot();
  }, [model, catalogUrl]);

  const handleSelect = (node: IStacNode, url: string) => {
    const title = node.title || node.id;
    setSelectedTitle(title);
    onCollectionSelect({ ...node, url });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingIcon size="lg" />
      </div>
    );
  }

  if (error || !rootNode) {
    return (
      <div className="text-sm text-red-600 p-3">
        {error || 'No catalog loaded'}
      </div>
    );
  }

  const rootChildren = rootNode.links.filter(
    l => l.rel === 'child' || l.rel === 'collection' || l.rel === 'data',
  );

  return (
    <div className="space-y-2">
      <label className="text-sm text-gray-600">Select a sub-collection</label>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9 px-3 text-sm"
          >
            <span className="truncate text-left flex-1">
              {selectedTitle || 'Select a collection...'}
            </span>
            <ChevronDown size={14} className="ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[280px] max-w-[90vw]">
          {rootChildren.length > 0 ? (
            <>
              <DropdownMenuLabel className="text-xs">
                {rootNode.title || rootNode.id}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[400px] overflow-y-auto">
                {rootChildren.map((link, idx) => (
                  <StacMenuItem
                    key={idx}
                    link={link}
                    baseUrl={catalogUrl}
                    model={model!}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            </>
          ) : (
            <DropdownMenuItem disabled>
              <span className="text-xs text-gray-400">
                No collections available
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedTitle && (
        <div className="text-xs text-gray-500 italic">
          Selected: {selectedTitle}
        </div>
      )}
    </div>
  );
};

export default CollectionBrowser;
