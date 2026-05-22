import * as React from 'react';

import { seedBackendCatalog } from './backendCatalog';
import {
  connect,
  IOpenEOConnectionInfo,
} from '../mainview/OpenEOTileLayer';

interface IDiscoveryPanelProps {
  /** Pre-fill the server URL field (optional). */
  initialServerUrl?: string;
}

interface ICollection {
  id: string;
  title?: string;
  description?: string;
  [key: string]: any;
}

interface IProcess {
  id: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  [key: string]: any;
}

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

const Section: React.FC<{
  title: string;
  count?: number;
  children: React.ReactNode;
}> = ({ title, count, children }) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="jp-openeo-section">
      <button
        type="button"
        className="jp-openeo-section-header"
        onClick={() => setOpen(o => !o)}
      >
        <span
          className={open ? 'jp-openeo-caret-down' : 'jp-openeo-caret-right'}
        >
          {open ? '▼' : '▶'}
        </span>
        <strong>{title}</strong>
        {count !== undefined && (
          <span className="jp-openeo-count">{count}</span>
        )}
      </button>
      {open && <div className="jp-openeo-section-body">{children}</div>}
    </div>
  );
};

const CollectionItem: React.FC<{ collection: ICollection }> = ({
  collection,
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="jp-openeo-list-item">
      <button
        type="button"
        className="jp-openeo-list-row"
        onClick={() => setOpen(o => !o)}
        title={collection.id}
      >
        <span className="jp-openeo-id">{collection.id}</span>
        {collection.title && (
          <span className="jp-openeo-secondary">{collection.title}</span>
        )}
      </button>
      {open && (
        <div className="jp-openeo-detail">
          {collection.description && <p>{collection.description}</p>}
          <pre>{JSON.stringify(collection, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

const ProcessItem: React.FC<{ process: IProcess }> = ({ process }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="jp-openeo-list-item">
      <button
        type="button"
        className="jp-openeo-list-row"
        onClick={() => setOpen(o => !o)}
        title={process.id}
      >
        <span className="jp-openeo-id">{process.id}</span>
        {process.summary && (
          <span className="jp-openeo-secondary">{process.summary}</span>
        )}
      </button>
      {open && (
        <div className="jp-openeo-detail">
          {process.description && <p>{process.description}</p>}
          {process.parameters && process.parameters.length > 0 && (
            <>
              <strong>Parameters</strong>
              <ul>
                {process.parameters.map((p: any) => (
                  <li key={p.name}>
                    <code>{p.name}</code>
                    {p.optional ? ' (optional)' : ''}
                    {p.description && <> — {p.description}</>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const OpenEODiscoveryPanel: React.FC<IDiscoveryPanelProps> = ({
  initialServerUrl,
}) => {
  const [serverUrl, setServerUrl] = React.useState<string>(
    initialServerUrl ?? '',
  );
  const [status, setStatus] = React.useState<ConnectionStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [collections, setCollections] = React.useState<ICollection[]>([]);
  const [processes, setProcesses] = React.useState<IProcess[]>([]);
  const [filter, setFilter] = React.useState<string>('');

  const doConnect = async () => {
    if (!serverUrl) {
      return;
    }
    setStatus('connecting');
    setError(null);
    setCollections([]);
    setProcesses([]);
    try {
      // Sign-in (if needed) is handled by the shared `connect` helper.
      const connectionInfo: IOpenEOConnectionInfo = { url: serverUrl };
      const connection = await connect(connectionInfo);
      const [cols, procs, formats] = await Promise.all([
        connection.listCollections(),
        connection.listProcesses(),
        (async () => {
          try {
            if (typeof (connection as any).listFileTypes === 'function') {
              return await (connection as any).listFileTypes();
            }
          } catch {
            /* ignore */
          }
          return null;
        })(),
      ]);
      const collectionList = ((cols as any).collections ?? []) as ICollection[];
      const processList = ((procs as any).processes ?? []) as IProcess[];
      const outputRaw: Record<string, any> =
        (typeof (formats as any)?.getOutputTypes === 'function'
          ? (formats as any).getOutputTypes()
          : (formats as any)?.data?.output) ?? {};
      const outputFormats = Object.keys(outputRaw).map(id => ({
        id,
        ...(outputRaw[id] ?? {}),
      }));
      setCollections(collectionList);
      setProcesses(processList);
      seedBackendCatalog(serverUrl, {
        collections: collectionList,
        processes: processList,
        outputFormats,
      });
      setStatus('connected');
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setStatus('error');
    }
  };

  const filteredCollections = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      return collections;
    }
    return collections.filter(
      c =>
        c.id.toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    );
  }, [collections, filter]);

  const filteredProcesses = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      return processes;
    }
    return processes.filter(
      p =>
        p.id.toLowerCase().includes(q) ||
        (p.summary ?? '').toLowerCase().includes(q),
    );
  }, [processes, filter]);

  return (
    <div className="jp-openeo-discovery">
      <div className="jp-openeo-discovery-header">
        <label>
          <span>Server URL</span>
          <input
            type="text"
            placeholder="https://openeo.example.org"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            disabled={status === 'connecting'}
          />
        </label>
        <div className="jp-openeo-discovery-actions">
          <button
            type="button"
            onClick={doConnect}
            disabled={!serverUrl || status === 'connecting'}
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        </div>
        {status === 'error' && (
          <p className="jp-openeo-error">Error: {error}</p>
        )}
      </div>

      {status === 'connected' && (
        <>
          <input
            type="text"
            className="jp-openeo-filter"
            placeholder="Filter collections and processes…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />

          <Section title="Collections" count={filteredCollections.length}>
            {filteredCollections.length === 0 ? (
              <p className="jp-openeo-empty">No matches.</p>
            ) : (
              filteredCollections.map(c => (
                <CollectionItem key={c.id} collection={c} />
              ))
            )}
          </Section>

          <Section title="Processes" count={filteredProcesses.length}>
            {filteredProcesses.length === 0 ? (
              <p className="jp-openeo-empty">No matches.</p>
            ) : (
              filteredProcesses.map(p => <ProcessItem key={p.id} process={p} />)
            )}
          </Section>
        </>
      )}
    </div>
  );
};
