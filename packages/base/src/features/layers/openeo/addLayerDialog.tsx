import { Dialog, Notification, ReactWidget } from '@jupyterlab/apputils';
import { AuthProvider } from '@openeo/js-client';
import * as React from 'react';

import { EditorAwareDialog } from '@/src/shared/editorAwareDialog';
import {
  describeConnectionError,
  fetchBackendCatalog,
  IBackendCatalog,
} from '@/src/tools';
import {
  createOpenEOTileService,
  openEOConnect,
  IOpenEOConnectionInfo,
  listOpenEOConnections,
  OpenEOSigninCancelled,
} from './OpenEOTileLayer';
import { CodeExportPanel } from './codeExportPanel';
import { JsonEditor } from './jsonEditor';
import { ProcessGraphView } from './processGraphView';
import { OpenEOSignin } from './signin';
import { normalizeSpatialExtent } from './templates';
import {
  IUserProcess,
  canSaveUserProcesses,
  fetchUserProcess,
  saveUserProcess,
} from './userProcesses';
import {
  IValidationError,
  mergeValidationErrors,
  validateProcessGraph,
  validateProcessGraphLocally,
} from './validation';

export interface IOpenEODialogResult {
  layerName: string;
  serverUrl: string;
  processGraph: Record<string, any>;
  /** The XYZ service created for the graph, when creating one worked. */
  tileServiceURL?: string;
}

interface IBodyState {
  layerName: string;
  editedGraph: Record<string, any> | null;
}

interface IMapView {
  latitude?: number;
  longitude?: number;
  zoom?: number;
}

interface IFormProps {
  initial: IBodyState;
  /**
   * Initial OpenEO connection (may be unset if the user hasn't picked a
   * server yet). The form lets the user switch servers via a combobox;
   * the active connection is held in component state.
   */
  initialConnection: IOpenEOConnectionInfo | null;
  /** Servers the user already authenticated against — populates the combobox. */
  knownServers: string[];
  /** Live map view to reproduce in the Code tab's JupyterGIS snippet. */
  mapView?: IMapView;
  onChange: (next: IBodyState) => void;
  onActiveServerChange: (info: IOpenEOConnectionInfo | null) => void;
  onValidationChange: (valid: boolean) => void;
}

type ValidationStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'valid' }
  | { state: 'invalid'; errors: IValidationError[] }
  | { state: 'advisory'; errors: IValidationError[] }
  | { state: 'error'; message: string };

const DRAG_MIME = 'application/x-openeo-node';

const DEFAULT_LAYER_NAME = 'OpenEO Layer';

type DragPayload =
  | { kind: 'collection'; id: string }
  | { kind: 'process'; id: string }
  | { kind: 'udp'; id: string }
  | { kind: 'format'; id: string };

function mintNodeKey(procId: string, existing: Set<string>): string {
  const base = procId.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'node';
  let n = 1;
  while (existing.has(`${base}${n}`)) {
    n += 1;
  }
  return `${base}${n}`;
}

function defaultArgsFromProcess(
  parameters: any[] | undefined,
): Record<string, any> {
  const args: Record<string, any> = {};
  if (!Array.isArray(parameters)) {
    return args;
  }
  for (const p of parameters) {
    if (!p || typeof p.name !== 'string') {
      continue;
    }
    if (p.default !== undefined) {
      args[p.name] = p.default;
    } else if (!p.optional) {
      args[p.name] = null;
    }
  }
  return args;
}

function buildCollectionNode(id: string): Record<string, any> {
  return {
    process_id: 'load_collection',
    arguments: {
      id,
      bands: [],
      properties: {},
      spatial_extent: null,
      temporal_extent: null,
    },
  };
}

function buildProcessNode(procId: string, process: any): Record<string, any> {
  return {
    process_id: procId,
    arguments: defaultArgsFromProcess(process?.parameters),
  };
}

function buildSaveResultNode(formatId: string): Record<string, any> {
  return {
    process_id: 'save_result',
    arguments: {
      data: null,
      format: formatId,
      options: {},
    },
  };
}

interface ICatalogPaletteProps {
  collections: any[] | undefined;
  processes: any[] | undefined;
  userProcesses: any[] | undefined;
  outputFormats: any[] | undefined;
  loading: boolean;
  onBack: () => void;
  /** Load a stored user-defined process into the editor. */
  onOpenUserProcess: (id: string) => void;
}

const CatalogPalette: React.FC<ICatalogPaletteProps> = ({
  collections,
  processes,
  userProcesses,
  outputFormats,
  loading,
  onBack,
  onOpenUserProcess,
}) => {
  const [filter, setFilter] = React.useState('');
  const [openCollections, setOpenCollections] = React.useState(true);
  const [openProcesses, setOpenProcesses] = React.useState(false);
  const [openUserProcesses, setOpenUserProcesses] = React.useState(false);
  const [openFormats, setOpenFormats] = React.useState(false);

  const q = filter.trim().toLowerCase();
  const filteredCollections = React.useMemo(() => {
    const list = collections ?? [];
    if (!q) {
      return list;
    }
    return list.filter(
      c =>
        (c.id ?? '').toLowerCase().includes(q) ||
        (c.title ?? '').toLowerCase().includes(q),
    );
  }, [collections, q]);

  const filteredProcesses = React.useMemo(() => {
    const list = processes ?? [];
    if (!q) {
      return list;
    }
    return list.filter(
      p =>
        (p.id ?? '').toLowerCase().includes(q) ||
        (p.summary ?? '').toLowerCase().includes(q),
    );
  }, [processes, q]);

  const filteredUserProcesses = React.useMemo(() => {
    const list = userProcesses ?? [];
    if (!q) {
      return list;
    }
    return list.filter(
      p =>
        (p.id ?? '').toLowerCase().includes(q) ||
        (p.summary ?? '').toLowerCase().includes(q),
    );
  }, [userProcesses, q]);

  const filteredFormats = React.useMemo(() => {
    const list = outputFormats ?? [];
    if (!q) {
      return list;
    }
    return list.filter(
      f =>
        (f.id ?? '').toLowerCase().includes(q) ||
        (f.title ?? '').toLowerCase().includes(q),
    );
  }, [outputFormats, q]);

  const onDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="jp-openeo-palette">
      <div className="jp-openeo-palette-header">
        <button
          type="button"
          className="jp-openeo-palette-back"
          onClick={onBack}
          aria-label="Back to form"
          title="Back to form"
        >
          ← Back
        </button>
        <strong>Catalog</strong>
      </div>
      <input
        type="text"
        className="jp-openeo-filter"
        placeholder="Search collections and processes…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      {loading && <p className="jp-openeo-empty">Loading catalog…</p>}
      {!loading && (
        <div className="jp-openeo-palette-sections">
          <PaletteSection
            title="Collections"
            count={filteredCollections.length}
            open={openCollections}
            onToggle={() => setOpenCollections(o => !o)}
          >
            {filteredCollections.map((c: any) => (
              <PaletteRow
                key={c.id}
                id={c.id}
                subtitle={c.title}
                onDragStart={e =>
                  onDragStart(e, { kind: 'collection', id: c.id })
                }
              />
            ))}
          </PaletteSection>
          <PaletteSection
            title="Processes"
            count={filteredProcesses.length}
            open={openProcesses}
            onToggle={() => setOpenProcesses(o => !o)}
          >
            {filteredProcesses.map((p: any) => (
              <PaletteRow
                key={p.id}
                id={p.id}
                subtitle={p.summary}
                onDragStart={e => onDragStart(e, { kind: 'process', id: p.id })}
              />
            ))}
          </PaletteSection>
          {(userProcesses?.length ?? 0) > 0 && (
            <PaletteSection
              title="User-Defined Processes"
              count={filteredUserProcesses.length}
              open={openUserProcesses}
              onToggle={() => setOpenUserProcesses(o => !o)}
            >
              {filteredUserProcesses.map((p: any) => (
                <PaletteRow
                  key={p.id}
                  id={p.id}
                  subtitle={p.summary ?? p.description}
                  onDragStart={e => onDragStart(e, { kind: 'udp', id: p.id })}
                  onOpen={() => onOpenUserProcess(p.id)}
                  openTitle={`Open ${p.id} in the editor`}
                />
              ))}
            </PaletteSection>
          )}
          <PaletteSection
            title="Output Formats"
            count={filteredFormats.length}
            open={openFormats}
            onToggle={() => setOpenFormats(o => !o)}
          >
            {filteredFormats.map((f: any) => (
              <PaletteRow
                key={f.id}
                id={f.id}
                subtitle={f.title}
                onDragStart={e => onDragStart(e, { kind: 'format', id: f.id })}
              />
            ))}
          </PaletteSection>
        </div>
      )}
    </div>
  );
};

const PaletteSection: React.FC<{
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, count, open, onToggle, children }) => {
  return (
    <div className={'jp-openeo-section' + (open ? ' jp-mod-open' : '')}>
      <button
        type="button"
        className="jp-openeo-section-header"
        onClick={onToggle}
      >
        <span
          className={open ? 'jp-openeo-caret-down' : 'jp-openeo-caret-right'}
        >
          {open ? '▼' : '▶'}
        </span>
        <strong>{title}</strong>
        <span className="jp-openeo-count">{count}</span>
      </button>
      {open && (
        <div className="jp-openeo-section-body jp-openeo-palette-body">
          {count === 0 ? (
            <p className="jp-openeo-empty">No matches.</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
};

const PaletteRow: React.FC<{
  id: string;
  subtitle?: string;
  onDragStart: (e: React.DragEvent) => void;
  onOpen?: () => void;
  openTitle?: string;
}> = ({ id, subtitle, onDragStart, onOpen, openTitle }) => {
  return (
    <div
      className="jp-openeo-palette-row"
      draggable
      onDragStart={onDragStart}
      title={`Drag ${id} onto the graph`}
    >
      <span className="jp-openeo-grip" aria-hidden="true">
        ⠿
      </span>
      <span className="jp-openeo-palette-row-text">
        <span className="jp-openeo-id">{id}</span>
        {subtitle && <span className="jp-openeo-secondary">{subtitle}</span>}
      </span>
      {onOpen && (
        <button
          type="button"
          className="jp-openeo-palette-row-open"
          onClick={onOpen}
          title={openTitle ?? `Open ${id}`}
          aria-label={openTitle ?? `Open ${id}`}
        >
          ✎
        </button>
      )}
    </div>
  );
};

const Form: React.FC<IFormProps> = ({
  initial,
  initialConnection,
  knownServers,
  mapView,
  onChange,
  onActiveServerChange,
  onValidationChange,
}) => {
  const [state, setState] = React.useState<IBodyState>(initial);
  // Active connection only counts if the URL is actually live in the
  // shared CONNECTIONS cache — a suggested URL from `_lastOpenEOConnection`
  // or an existing layer doesn't imply we're signed in to it.
  const [connectionInfo, setConnectionInfoState] =
    React.useState<IOpenEOConnectionInfo | null>(() => {
      if (!initialConnection?.url) {
        return null;
      }
      return listOpenEOConnections().includes(initialConnection.url)
        ? initialConnection
        : null;
    });
  // Combined known set: prop list + any server the user connects to
  // mid-dialog. State so the datalist refreshes when a brand new server
  // is added.
  const [servers, setServers] = React.useState<string[]>(() =>
    Array.from(
      new Set(
        [
          ...knownServers,
          ...(initialConnection?.url ? [initialConnection.url] : []),
        ].filter(Boolean),
      ),
    ),
  );
  // Pending text in the server input field — distinct from active
  // `connectionInfo.url` so the user can type freely without breaking
  // catalog/validation until they hit Connect.
  const [serverInput, setServerInput] = React.useState<string>(
    initialConnection?.url ?? '',
  );
  const [serverBusy, setServerBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [authProviders, setAuthProviders] = React.useState<
    AuthProvider[] | null
  >(null);
  const [serverTitle, setServerTitle] = React.useState('');
  const [anonymous, setAnonymous] = React.useState(false);
  // Resolver of the promise openEOConnect() is waiting on while the
  // sign-in form is up.
  const signinDone = React.useRef<((ok: boolean) => void) | null>(null);
  // Server section has three explicit modes: pick/enter a URL, sign in,
  // or already connected. The sign-in form is only visible in 'signin' so
  // it doesn't clutter the dialog when not needed.
  type ServerMode = 'select' | 'signin' | 'connected';
  const [serverMode, setServerMode] = React.useState<ServerMode>(() =>
    connectionInfo?.url ? 'connected' : 'select',
  );
  React.useEffect(() => () => signinDone.current?.(false), []);

  const setConnectionInfo = (next: IOpenEOConnectionInfo | null) => {
    setConnectionInfoState(next);
    onActiveServerChange(next);
  };

  const update = (patch: Partial<IBodyState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  };

  // Prompt before discarding user edits when loading another graph.
  const guardReseed = (apply: () => void) => {
    if (state.editedGraph) {
      const ok = window.confirm(
        'You have manual edits to the process graph. Continue and discard them?',
      );
      if (!ok) {
        return;
      }
    }
    apply();
  };

  // Step 1: user picks/enters a URL and clicks Connect. If the URL is
  // already in the live cache, adopt it; otherwise reveal the
  // credentials inputs.
  const onPickServer = () => {
    const raw = serverInput.trim();
    if (!raw) {
      setServerError('Enter an OpenEO server URL.');
      return;
    }
    setServerError(null);
    if (listOpenEOConnections().includes(raw)) {
      setConnectionInfo({ url: raw });
      setServers(prev => (prev.includes(raw) ? prev : [...prev, raw]));
      setServerMode('connected');
      return;
    }
    void signInToServer(raw);
  };

  // Step 2: connect and let the user sign in with any method the server
  // offers. The form renders inline through the `authenticate` hook,
  // because JupyterLab queues nested dialogs behind this one.
  const signInToServer = async (raw: string) => {
    setServerBusy(true);
    setAuthProviders(null);
    setServerTitle('');
    setAnonymous(false);
    setServerMode('signin');
    const next: IOpenEOConnectionInfo = {
      url: raw,
      authenticate: (providers, connection) => {
        setAuthProviders(providers);
        setServerTitle(connection.capabilities().title());
        setServerBusy(false);
        return new Promise<boolean>(resolve => {
          signinDone.current = resolve;
        });
      },
    };
    try {
      await openEOConnect(next);
    } catch (err) {
      signinDone.current = null;
      setServerBusy(false);
      setServerMode('select');
      if (!(err instanceof OpenEOSigninCancelled)) {
        setServerError(describeConnectionError(err, next.url ?? raw));
      }
      return;
    }
    signinDone.current = null;
    // connect() may normalize the url (e.g. add https://) — reflect
    // that back so downstream references match.
    const resolved = next.url ?? raw;
    setServerInput(resolved);
    setServers(prev => (prev.includes(resolved) ? prev : [...prev, resolved]));
    setConnectionInfo(next);
    setServerBusy(false);
    setServerMode('connected');
  };

  const onChangeServer = () => {
    signinDone.current?.(false);
    signinDone.current = null;
    setServerError(null);
    setServerBusy(false);
    setServerMode('select');
  };

  // Memoize the graph so its identity only changes when the contents
  // actually change. Otherwise every render produces a new object,
  // re-firing validation and reassigning ModelBuilder.value mid-edit.
  const effectiveGraph = React.useMemo(() => {
    const graph = state.editedGraph ?? {};
    // An empty `spatial_extent: {}` (e.g. from a graph authored before we
    // sent a real extent) is invalid per the openEO schema; normalize it to
    // `null` so validation doesn't block an otherwise-valid graph.
    return normalizeSpatialExtent(graph);
  }, [state.editedGraph]);
  const effectiveGraphJson = React.useMemo(
    () => JSON.stringify(effectiveGraph, null, 2),
    [effectiveGraph],
  );
  const isEmptyGraph = Object.keys(effectiveGraph).length === 0;
  const [viewMode, setViewMode] = React.useState<'graph' | 'json' | 'code'>(
    'graph',
  );
  const [editMode, setEditMode] = React.useState(false);
  // The stored user-defined process the editor is currently working on, if
  // any. Holds the UDP's metadata (parameters, summary…) so saving back
  // round-trips everything the graph editor doesn't touch.
  const [editingUdp, setEditingUdp] = React.useState<IUserProcess | null>(null);
  const [udpBusy, setUdpBusy] = React.useState(false);
  const [udpError, setUdpError] = React.useState<string | null>(null);
  const [canSaveUdp, setCanSaveUdp] = React.useState(false);
  // Non-null while the "save as a new process" form is open.
  const [saveAsForm, setSaveAsForm] = React.useState<{
    id: string;
    summary: string;
  } | null>(null);
  // Local JSON buffer so the user can type freely; on valid parse, push
  // back to state.editedGraph. Reseeded whenever effectiveGraph changes
  // from outside (e.g. an import).
  const initialJsonText = effectiveGraphJson;
  const [jsonText, setJsonText] = React.useState(initialJsonText);
  const [jsonError, setJsonError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setJsonText(initialJsonText);
    setJsonError(null);
  }, [initialJsonText]);

  const onJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setJsonError(null);
        setState(prev => {
          const next = { ...prev, editedGraph: parsed };
          onChange(next);
          return next;
        });
      } else {
        setJsonError('Process graph must be a JSON object.');
      }
    } catch (e: any) {
      setJsonError(e?.message ?? String(e));
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onImportClick = () => fileInputRef.current?.click();
  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept either a raw process_graph dict or a full Process object.
      const graph =
        parsed && typeof parsed === 'object' && 'process_graph' in parsed
          ? parsed.process_graph
          : parsed;
      if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
        Notification.error(
          'Imported file is not a valid openEO process graph (expected a JSON object).',
          { autoClose: 4000 },
        );
        return;
      }
      setState(prev => {
        const next = { ...prev, editedGraph: graph };
        onChange(next);
        return next;
      });
      Notification.success(`Imported process graph from ${file.name}.`, {
        autoClose: 2500,
      });
    } catch (err: any) {
      Notification.error(
        `Failed to import ${file.name}: ${err?.message ?? String(err)}`,
        { autoClose: 5000 },
      );
    }
  };

  const onExport = () => {
    // Wrap in the openEO Process envelope so the file round-trips with
    // openeo-web-editor and other openEO tooling.
    const exported = {
      process_graph: effectiveGraph,
      parameters: [],
    };
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (state.layerName || 'process-graph')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .toLowerCase();
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Backend catalog (processes + collections + output formats).
  const [catalog, setCatalog] = React.useState<IBackendCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  // Bumped after storing a UDP so the palette picks up the new/changed entry.
  const [catalogVersion, setCatalogVersion] = React.useState(0);

  // Two validation passes, both race-guarded by a version counter:
  //   - Local (synchronous-ish, via @openeo/js-processgraphs): catches
  //     argument-schema violations the backend's POST /validation can
  //     miss (e.g. `apply.process` being a from_node instead of a
  //     callback). Same library openeo-web-editor uses. Updates state
  //     immediately, no debounce.
  //   - Backend: authoritative for things only the server knows
  //     (collection availability, namespaced/extension processes).
  //     Debounced; merges its errors with the local pass on arrival.
  const [validation, setValidation] = React.useState<ValidationStatus>({
    state: 'pending',
  });
  const [isChecking, setIsChecking] = React.useState(true);
  const versionRef = React.useRef(0);
  const lastResultVersionRef = React.useRef(-1);
  const localErrorsRef = React.useRef<IValidationError[]>([]);

  React.useEffect(() => {
    versionRef.current += 1;
    const myVersion = versionRef.current;
    setIsChecking(true);

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(effectiveGraphJson);
    } catch (err: any) {
      if (versionRef.current === myVersion) {
        setValidation({
          state: 'invalid',
          errors: [
            {
              code: 'InvalidJSON',
              message: err?.message ?? 'Process graph is not valid JSON.',
            },
          ],
        });
        lastResultVersionRef.current = myVersion;
        setIsChecking(false);
      }
      return;
    }

    // Nothing to validate until the user imports or builds a graph.
    if (Object.keys(parsed).length === 0) {
      setValidation({ state: 'idle' });
      lastResultVersionRef.current = myVersion;
      setIsChecking(false);
      return;
    }

    // Local pass — runs immediately so the user sees structural errors
    // (missing required args, wrong argument types, etc) without waiting
    // for the network. Stored in a ref so the backend pass can merge.
    localErrorsRef.current = [];
    validateProcessGraphLocally(
      parsed,
      catalog?.processes,
      catalog?.userProcesses,
      editingUdp?.parameters,
    ).then(local => {
      if (versionRef.current !== myVersion) {
        return;
      }
      localErrorsRef.current = local;
      // Optimistic apply: show local results right away. Advisory, not
      // invalid — at this point every finding is one only the local pass
      // has made, and the backend has not had its say. The backend pass
      // overwrites with the merged verdict when it lands.
      setValidation(
        local.length === 0
          ? { state: 'valid' }
          : { state: 'advisory', errors: local },
      );
      lastResultVersionRef.current = myVersion;
    });

    // Backend pass — debounced. Skipped if no server is connected yet.
    const handle = window.setTimeout(async () => {
      if (!connectionInfo) {
        if (versionRef.current === myVersion) {
          setValidation({ state: 'valid' });
          lastResultVersionRef.current = myVersion;
          setIsChecking(false);
        }
        return;
      }
      let backendErrors: IValidationError[] = [];
      let networkErrorMessage: string | null = null;
      try {
        backendErrors = await validateProcessGraph(
          connectionInfo,
          parsed,
          editingUdp?.parameters,
        );
      } catch (err: any) {
        networkErrorMessage = err?.message ?? String(err);
      }
      if (versionRef.current !== myVersion) {
        return;
      }
      const merged = mergeValidationErrors(
        localErrorsRef.current,
        backendErrors,
      );
      let result: ValidationStatus;
      if (merged.length > 0) {
        // The backend is the authority on its own processes. When it ran and
        // accepted the graph, a finding only our stricter local pass makes
        // (a backend process whose spec omits an argument the openEO client
        // always sends, say `context` on a reducer) is reported but does not
        // block the layer.
        const localOnly = backendErrors.length === 0 && !networkErrorMessage;
        result = localOnly
          ? { state: 'advisory', errors: merged }
          : { state: 'invalid', errors: merged };
      } else if (networkErrorMessage) {
        result = { state: 'error', message: networkErrorMessage };
      } else {
        result = { state: 'valid' };
      }
      setValidation(result);
      lastResultVersionRef.current = myVersion;
      setIsChecking(false);
    }, 350);

    return () => {
      window.clearTimeout(handle);
    };
  }, [
    effectiveGraphJson,
    connectionInfo,
    catalog?.processes,
    catalog?.userProcesses,
    editingUdp,
  ]);

  React.useEffect(() => {
    const fresh = lastResultVersionRef.current === versionRef.current;
    // Adding a layer also requires a live, authenticated connection: the
    // source needs a serverUrl, and creating the XYZ service needs a
    // session.
    onValidationChange(
      Boolean(connectionInfo?.url) &&
        !anonymous &&
        (validation.state === 'valid' || validation.state === 'advisory') &&
        !isChecking &&
        fresh,
    );
  }, [validation, isChecking, connectionInfo, anonymous, onValidationChange]);

  // Fetch backend catalog (processes + collections) so ModelBuilder can
  // label ports with types. Cached, so this is free if the Discovery
  // panel already populated the cache.
  React.useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    if (!connectionInfo) {
      setCatalogLoading(false);
      return;
    }
    setCatalogLoading(true);
    const url = connectionInfo.url;
    fetchBackendCatalog(connectionInfo)
      .then(c => {
        if (!cancelled) {
          setCatalog(c);
          setCatalogLoading(false);
        }
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        setCatalogLoading(false);
        Notification.warning(
          `OpenEO: couldn't load the process/collection catalog from ${url}. The graph editor will still work, but ports won't be type-labeled.`,
          { autoClose: 4000 },
        );
        // eslint-disable-next-line no-console
        console.warn('OpenEO catalog fetch failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [connectionInfo, catalogVersion]);

  // Does this backend let the signed-in user store process graphs? Backends
  // without PUT /process_graphs hide the save UI.
  React.useEffect(() => {
    let cancelled = false;
    if (!connectionInfo) {
      setCanSaveUdp(false);
      return;
    }
    canSaveUserProcesses(connectionInfo).then(ok => {
      if (!cancelled) {
        setCanSaveUdp(ok);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [connectionInfo]);

  // Pull a stored UDP's full definition (the list endpoint only returns
  // summaries) and load its graph into the editor.
  const onOpenUserProcess = (id: string) => {
    if (!connectionInfo) {
      return;
    }
    guardReseed(() => {
      setUdpBusy(true);
      setUdpError(null);
      fetchUserProcess(connectionInfo, id)
        .then(udp => {
          setEditingUdp(udp);
          setState(prev => {
            const next = { ...prev, editedGraph: udp.processGraph };
            onChange(next);
            return next;
          });
          setSaveAsForm(null);
          setViewMode('graph');
        })
        .catch(err => {
          setUdpError(`Couldn't load '${id}': ${err?.message ?? String(err)}`);
        })
        .finally(() => setUdpBusy(false));
    });
  };

  const storeUserProcess = (udp: IUserProcess, label: string) => {
    if (!connectionInfo) {
      return;
    }
    setUdpBusy(true);
    setUdpError(null);
    saveUserProcess(connectionInfo, udp)
      .then(() => {
        setEditingUdp(udp);
        setSaveAsForm(null);
        setCatalogVersion(v => v + 1);
        Notification.success(label, { autoClose: 2500 });
      })
      .catch(err => {
        setUdpError(
          `Couldn't save '${udp.id}': ${err?.message ?? String(err)}`,
        );
      })
      .finally(() => setUdpBusy(false));
  };

  const onSaveUserProcess = () => {
    if (!editingUdp) {
      return;
    }
    storeUserProcess(
      { ...editingUdp, processGraph: effectiveGraph },
      `Saved changes to user-defined process "${editingUdp.id}".`,
    );
  };

  const onSaveUserProcessAs = () => {
    const form = saveAsForm;
    if (!form) {
      return;
    }
    const id = form.id.trim();
    if (!/^\w+$/.test(id)) {
      setUdpError(
        'A process id may only contain letters, digits and underscores.',
      );
      return;
    }
    const summary = form.summary.trim();
    storeUserProcess(
      {
        id,
        processGraph: effectiveGraph,
        // A graph saved from the layer editor has no declared parameters
        // unless it came from a UDP that did.
        parameters: editingUdp?.parameters ?? [],
        metadata: {
          ...(editingUdp?.metadata ?? {}),
          ...(summary ? { summary } : {}),
        },
      },
      `Stored process graph as user-defined process "${id}".`,
    );
  };

  const onStopEditingUserProcess = () => {
    setEditingUdp(null);
    setUdpError(null);
    setSaveAsForm(null);
  };

  // Invoke a method on the embedded openeo-model-builder Vue instance
  // (e.g. undo/redo). Resolves the instance from the live DOM rather
  // than holding a ref so we don't fight ModelBuilder's own remount.
  const callModelBuilder = (method: 'undo' | 'redo') => () => {
    const el = document.getElementById('jp-openeo-model-builder');
    const root = (el as any)?.shadowRoot?.querySelector(
      '.vue-component.model-builder',
    );
    const vueInst = root?.__vue__;
    vueInst?.[method]?.();
  };

  // Drop handling: insert a node into the effective graph at the user's
  // request. The dropped node gets a freshly minted key; the user wires
  // it to the rest of the graph manually.
  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragDepthRef = React.useRef(0);

  const insertNode = (payload: DragPayload) => {
    const base = state.editedGraph ?? {};
    const existing = new Set(Object.keys(base));
    let node: Record<string, any>;
    let procId: string;
    if (payload.kind === 'collection') {
      procId = 'load_collection';
      node = buildCollectionNode(payload.id);
    } else if (payload.kind === 'format') {
      procId = 'save_result';
      node = buildSaveResultNode(payload.id);
    } else if (payload.kind === 'udp') {
      procId = payload.id;
      const udp = (catalog?.userProcesses ?? []).find(
        (p: any) => p?.id === payload.id,
      );
      node = buildProcessNode(payload.id, udp);
    } else {
      procId = payload.id;
      const proc = (catalog?.processes ?? []).find(
        (p: any) => p?.id === payload.id,
      );
      node = buildProcessNode(payload.id, proc);
    }
    const key = mintNodeKey(procId, existing);
    // ModelBuilder can't load a graph that has no result node.
    const hasResult = Object.values(base).some((n: any) => n?.result === true);
    const nextGraph = {
      ...base,
      [key]: hasResult ? node : { ...node, result: true },
    };
    setState(prev => {
      const next = { ...prev, editedGraph: nextGraph };
      onChange(next);
      return next;
    });
    Notification.success(`Added ${procId} node "${key}".`, {
      autoClose: 1800,
    });
  };

  const onCanvasDragEnter = (e: React.DragEvent) => {
    if (!editMode) {
      return;
    }
    if (!e.dataTransfer.types.includes(DRAG_MIME)) {
      return;
    }
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };
  const onCanvasDragOver = (e: React.DragEvent) => {
    if (!editMode) {
      return;
    }
    if (!e.dataTransfer.types.includes(DRAG_MIME)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onCanvasDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };
  const onCanvasDrop = (e: React.DragEvent) => {
    if (!editMode) {
      return;
    }
    const data = e.dataTransfer.getData(DRAG_MIME);
    if (!data) {
      return;
    }
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    try {
      const payload = JSON.parse(data) as DragPayload;
      if (
        payload &&
        (payload.kind === 'collection' ||
          payload.kind === 'process' ||
          payload.kind === 'udp' ||
          payload.kind === 'format')
      ) {
        insertNode(payload);
      }
    } catch {
      // Bad payload — ignore.
    }
  };

  // Stage 1 and 2: pick a server, then sign in. The editor itself stays
  // hidden until there is a session, like editor.openeo.org.
  if (serverMode !== 'connected') {
    return (
      <div className="jp-openeo-dialog jp-mod-connect">
        <div className="jp-openeo-connect-panel">
          {serverMode === 'select' ? (
            <>
              <h3 className="jp-openeo-signin-title">
                Connect to an openEO server
              </h3>
              <label className="jp-openeo-field">
                <span>Server URL</span>
                <div className="jp-openeo-server-picker">
                  <input
                    type="text"
                    list="jp-openeo-known-servers"
                    placeholder="https://openeo.example.org"
                    autoFocus
                    value={serverInput}
                    onChange={e => {
                      setServerInput(e.target.value);
                      if (serverError) {
                        setServerError(null);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onPickServer();
                      }
                    }}
                  />
                  <datalist id="jp-openeo-known-servers">
                    {servers.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="jp-openeo-server-connect"
                    onClick={onPickServer}
                    disabled={!serverInput.trim()}
                  >
                    Connect
                  </button>
                </div>
              </label>
              {servers.length > 0 && (
                <div className="jp-openeo-server-suggest">
                  {servers.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="jp-openeo-server-chip"
                      onClick={() => setServerInput(s)}
                      title={`Use ${s}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {serverError && (
                <div className="jp-openeo-server-alert jp-mod-error">
                  {serverError}
                </div>
              )}
            </>
          ) : serverBusy || !authProviders ? (
            <div className="jp-openeo-connect-status">
              {authProviders ? 'Finishing sign-in…' : 'Connecting…'}
            </div>
          ) : (
            <OpenEOSignin
              providers={authProviders}
              serverTitle={serverTitle || serverInput.trim()}
              allowAnonymous
              onSwitchServer={onChangeServer}
              onSignedIn={isAnonymous => {
                setAnonymous(isAnonymous);
                setServerBusy(true);
                signinDone.current?.(true);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="jp-openeo-dialog">
      <div className="jp-openeo-dialog-left">
        {editMode ? (
          <CatalogPalette
            collections={catalog?.collections}
            processes={catalog?.processes}
            userProcesses={catalog?.userProcesses}
            outputFormats={catalog?.outputFormats}
            loading={catalogLoading}
            onBack={() => setEditMode(false)}
            onOpenUserProcess={onOpenUserProcess}
          />
        ) : (
          <>
            <section className="jp-openeo-section">
              <h4>Layer</h4>
              <label className="jp-openeo-field">
                <span>Name</span>
                <input
                  type="text"
                  value={state.layerName}
                  onChange={e => update({ layerName: e.target.value })}
                />
              </label>
              <div className="jp-openeo-server-section">
                <div className="jp-openeo-server-connected">
                  <span
                    className={
                      anonymous
                        ? 'jp-openeo-server-anon'
                        : 'jp-openeo-server-ok'
                    }
                  >
                    {anonymous ? '!' : '✓'}
                  </span>
                  <code title={connectionInfo?.url}>
                    {serverTitle || connectionInfo?.url}
                  </code>
                  <button
                    type="button"
                    className="jp-openeo-link-btn"
                    onClick={onChangeServer}
                  >
                    Switch server
                  </button>
                </div>
                {anonymous && (
                  <div className="jp-openeo-server-alert jp-mod-warn">
                    Not signed in. Browse the server freely; log in before
                    adding the layer.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <div className="jp-openeo-dialog-right">
        <div className="jp-openeo-toolbar">
          <div className="jp-openeo-segmented">
            <button
              type="button"
              className={viewMode === 'graph' ? 'jp-mod-selected' : ''}
              onClick={() => setViewMode('graph')}
            >
              Graph
            </button>
            <button
              type="button"
              className={viewMode === 'json' ? 'jp-mod-selected' : ''}
              onClick={() => setViewMode('json')}
            >
              JSON
            </button>
            <button
              type="button"
              className={viewMode === 'code' ? 'jp-mod-selected' : ''}
              onClick={() => setViewMode('code')}
            >
              Code
            </button>
          </div>
          {viewMode !== 'code' && (
            <button
              type="button"
              className={
                'jp-openeo-toolbar-toggle jp-openeo-icon-btn' +
                (editMode ? ' jp-mod-selected' : '')
              }
              onClick={() => setEditMode(v => !v)}
              title={editMode ? 'Exit edit mode' : 'Edit graph or JSON'}
              aria-label="Toggle edit mode"
            >
              ✎
            </button>
          )}
          {editMode && viewMode === 'graph' && (
            <>
              <button
                type="button"
                className="jp-openeo-toolbar-btn jp-openeo-icon-btn"
                onClick={callModelBuilder('undo')}
                title="Undo last graph edit (Ctrl/⌘+Z)"
                aria-label="Undo"
              >
                ↶
              </button>
              <button
                type="button"
                className="jp-openeo-toolbar-btn jp-openeo-icon-btn"
                onClick={callModelBuilder('redo')}
                title="Redo (Ctrl/⌘+Shift+Z)"
                aria-label="Redo"
              >
                ↷
              </button>
            </>
          )}
          <button
            type="button"
            className="jp-openeo-toolbar-btn jp-openeo-icon-btn"
            onClick={onImportClick}
            title="Import: replace the graph with a JSON file from disk"
            aria-label="Import graph"
          >
            ⤓
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
          <button
            type="button"
            className="jp-openeo-toolbar-btn jp-openeo-icon-btn"
            onClick={onExport}
            title="Export: download the current process graph as JSON"
            aria-label="Export graph"
          >
            ⤒
          </button>
          {canSaveUdp && !saveAsForm && !editingUdp && (
            <button
              type="button"
              className="jp-openeo-toolbar-btn"
              onClick={() => {
                setUdpError(null);
                setSaveAsForm({ id: '', summary: '' });
              }}
              title="Store the current process graph on the server as a user-defined process"
            >
              Save as UDP
            </button>
          )}
          <div className="jp-openeo-toolbar-spacer" />
          <span
            className={
              'jp-openeo-status ' +
              (validation.state === 'valid'
                ? 'jp-openeo-status-ok'
                : validation.state === 'invalid' || validation.state === 'error'
                  ? 'jp-openeo-status-bad'
                  : validation.state === 'advisory'
                    ? 'jp-openeo-status-warn'
                    : 'jp-openeo-status-pending')
            }
            title={
              validation.state === 'error' ? validation.message : undefined
            }
          >
            {isChecking && (
              <span className="jp-openeo-spinner" aria-label="Re-checking">
                ⟳
              </span>
            )}
            {validation.state === 'pending' && 'checking schema…'}
            {validation.state === 'valid' && 'schema OK'}
            {validation.state === 'invalid' &&
              `${validation.errors.length} schema issue${validation.errors.length === 1 ? '' : 's'}`}
            {validation.state === 'advisory' &&
              `${validation.errors.length} advisory issue${validation.errors.length === 1 ? '' : 's'}${isChecking ? '' : ' (server accepted)'}`}
            {validation.state === 'error' && "couldn't reach validator"}
            {validation.state === 'idle' && ' '}
          </span>
        </div>
        {editMode && (
          <p className="jp-openeo-edit-hint-inline">
            Editing is advanced. Click an edge or block then press Backspace (or
            fn+Delete) to remove it.
          </p>
        )}
        {(editingUdp || saveAsForm || udpBusy || udpError) && (
          <div className="jp-openeo-udp-bar">
            {udpBusy && !editingUdp && (
              <div className="jp-openeo-udp-bar-row">
                <span className="jp-openeo-spinner" aria-label="Working">
                  ⟳
                </span>
                <span className="jp-openeo-udp-bar-label">
                  Talking to the server…
                </span>
              </div>
            )}
            {editingUdp && (
              <div className="jp-openeo-udp-bar-row">
                <span className="jp-openeo-udp-bar-label">
                  Editing user-defined process
                </span>
                <code>{editingUdp.id}</code>
                <div className="jp-openeo-toolbar-spacer" />
                {udpBusy && (
                  <span className="jp-openeo-spinner" aria-label="Working">
                    ⟳
                  </span>
                )}
                {canSaveUdp && (
                  <>
                    <button
                      type="button"
                      className="jp-openeo-toolbar-btn"
                      onClick={onSaveUserProcess}
                      disabled={udpBusy}
                      title={`Save the current graph back to '${editingUdp.id}' on the server`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="jp-openeo-toolbar-btn"
                      onClick={() => {
                        setUdpError(null);
                        setSaveAsForm({ id: '', summary: '' });
                      }}
                      disabled={udpBusy || Boolean(saveAsForm)}
                      title="Store the current graph under a new id"
                    >
                      Save as…
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="jp-openeo-link-btn"
                  onClick={onStopEditingUserProcess}
                  disabled={udpBusy}
                  title="Keep the graph in the editor but stop tracking the stored process"
                >
                  Stop editing
                </button>
              </div>
            )}
            {saveAsForm && (
              <div className="jp-openeo-udp-bar-row">
                <input
                  type="text"
                  className="jp-openeo-udp-id"
                  placeholder="Process name"
                  autoFocus
                  value={saveAsForm.id}
                  onChange={e =>
                    setSaveAsForm({ ...saveAsForm, id: e.target.value })
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSaveUserProcessAs();
                    }
                  }}
                />
                <input
                  type="text"
                  className="jp-openeo-udp-summary"
                  placeholder="Summary (optional)"
                  value={saveAsForm.summary}
                  onChange={e =>
                    setSaveAsForm({ ...saveAsForm, summary: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="jp-openeo-toolbar-btn"
                  onClick={onSaveUserProcessAs}
                  disabled={udpBusy || !saveAsForm.id.trim()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="jp-openeo-link-btn"
                  onClick={() => {
                    setSaveAsForm(null);
                    setUdpError(null);
                  }}
                  disabled={udpBusy}
                >
                  Cancel
                </button>
              </div>
            )}
            {saveAsForm &&
              (catalog?.userProcesses ?? []).some(
                (up: any) => up?.id === saveAsForm.id.trim(),
              ) && (
                <div className="jp-openeo-server-alert jp-mod-warn">
                  A user-defined process with this id already exists and will be
                  replaced.
                </div>
              )}
            {udpError && (
              <div className="jp-openeo-server-alert jp-mod-error">
                {udpError}
              </div>
            )}
          </div>
        )}
        <div
          className={
            'jp-openeo-canvas-wrapper' +
            (isDragOver ? ' jp-mod-drop-target' : '')
          }
          onDragEnter={onCanvasDragEnter}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          {isDragOver && (
            <div className="jp-openeo-drop-overlay">
              Drop to add node to graph
            </div>
          )}
          {isEmptyGraph && !isDragOver && viewMode === 'graph' && (
            <div className="jp-openeo-empty-graph">
              {editMode
                ? 'Drag a collection or process from the catalog onto the canvas.'
                : 'No process graph yet. Import a JSON file, or click ✎ to build one from the server catalog.'}
            </div>
          )}
          {viewMode === 'code' ? (
            <CodeExportPanel
              graph={effectiveGraph}
              serverUrl={connectionInfo?.url}
              layerName={state.layerName}
              mapView={mapView}
            />
          ) : viewMode === 'json' ? (
            editMode ? (
              <JsonEditor
                value={jsonText}
                onChange={onJsonChange}
                parseError={jsonError}
              />
            ) : (
              <pre className="jp-openeo-graph-preview">{initialJsonText}</pre>
            )
          ) : (
            <ProcessGraphView
              graph={effectiveGraph}
              editable={editMode}
              processes={catalog?.processes}
              userProcesses={catalog?.userProcesses}
              collections={catalog?.collections}
              onEdit={next =>
                setState(prev => {
                  const updated = { ...prev, editedGraph: next };
                  onChange(updated);
                  return updated;
                })
              }
            />
          )}
        </div>
        {(validation.state === 'invalid' ||
          validation.state === 'advisory') && (
          <ul className="jp-openeo-validation-errors">
            {validation.errors.slice(0, 10).map((e, i) => (
              <li key={i}>
                {e.code && <code>{e.code}</code>} {e.message}
              </li>
            ))}
            {validation.errors.length > 10 && (
              <li>…and {validation.errors.length - 10} more</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

class AddLayerBody extends ReactWidget {
  constructor(
    initial: IBodyState,
    initialConnection: IOpenEOConnectionInfo | null,
    private _knownServers: string[],
    private _onValidationChange: (valid: boolean) => void,
    private _mapView?: IMapView,
  ) {
    super();
    this._state = initial;
    this._activeConnection = initialConnection;
    this.addClass('jp-openeo-add-layer-body');
  }

  protected render(): JSX.Element {
    return (
      <Form
        initial={this._state}
        initialConnection={this._activeConnection}
        knownServers={this._knownServers}
        mapView={this._mapView}
        onChange={next => {
          this._state = next;
        }}
        onActiveServerChange={info => {
          this._activeConnection = info;
        }}
        onValidationChange={this._onValidationChange}
      />
    );
  }

  getValue(): IOpenEODialogResult | null {
    if (!this._state.editedGraph || !this._activeConnection?.url) {
      return null;
    }
    return {
      layerName: this._state.layerName || DEFAULT_LAYER_NAME,
      serverUrl: this._activeConnection.url,
      processGraph: this._state.editedGraph,
    };
  }

  private _state: IBodyState;
  private _activeConnection: IOpenEOConnectionInfo | null;
}

export interface IOpenEODialogOptions {
  /**
   * Optional pre-established OpenEO connection. When omitted, the user
   * picks/connects a server inside the dialog. When provided, the
   * combobox is pre-selected to it.
   */
  connectionInfo?: IOpenEOConnectionInfo | null;
  /**
   * Server URLs to pre-populate the combobox with (e.g. servers already
   * authenticated this session, or used by existing layers in the doc).
   */
  knownServers?: string[];
  /** Pre-fill graph. */
  initialGraph?: Record<string, any>;
  /** Pre-fill layer name. */
  layerName?: string;
  /** Dialog title. */
  title?: string;
  /** OK button label. */
  okLabel?: string;
  /**
   * The document's current map view (center + zoom, EPSG:4326). Baked into
   * the Code tab's JupyterGIS snippet so exported code opens on the same
   * viewport the user is looking at.
   */
  mapView?: IMapView;
}

export async function showAddOpenEOLayerDialog(
  options: IOpenEODialogOptions,
): Promise<IOpenEODialogResult | null> {
  const initial: IBodyState = {
    layerName: options.layerName ?? DEFAULT_LAYER_NAME,
    editedGraph: options.initialGraph ?? null,
  };

  // Toggle the Lumino-rendered OK button based on validity. Held outside
  // React because the button lives on the Dialog node, not in our subtree.
  // Starts disabled — the first validation pass flips it on if clean.
  let lastValid = false;
  const applyOk = () => {
    const ok = document.querySelector<HTMLButtonElement>(
      '.jp-Dialog .jp-mod-accept',
    );
    if (!ok) {
      return;
    }
    ok.disabled = !lastValid;
    ok.title = lastValid
      ? ''
      : 'Connect to an OpenEO server and resolve any process-graph validation errors before adding the layer.';
  };
  const body = new AddLayerBody(
    initial,
    options.connectionInfo ?? null,
    options.knownServers ?? [],
    valid => {
      lastValid = valid;
      applyOk();
    },
    options.mapView,
  );

  const resultPromise = new EditorAwareDialog<IOpenEODialogResult | null>({
    title: options.title ?? 'Add OpenEO Layer',
    body,
    buttons: [
      Dialog.cancelButton(),
      Dialog.okButton({ label: options.okLabel ?? 'Add Layer' }),
    ],
  }).launch();
  // Apply the initial disabled state once the dialog mounts. JupyterLab's
  // Dialog re-enables the accept button from a document-level capture
  // listener on every input event, so re-assert ours after it bubbles.
  window.setTimeout(applyOk, 0);
  body.node.addEventListener('input', applyOk);
  const result = await resultPromise;

  if (!result.button.accept || !result.value) {
    return null;
  }

  // Create the service here, where we are signed in, so the url can be saved
  // in the document. On failure the tile source tries again, as it used to.
  try {
    result.value.tileServiceURL = await createOpenEOTileService(
      result.value.serverUrl,
      result.value.processGraph,
    );
  } catch (error) {
    console.warn('[openeo] could not create the tile service upfront:', error);
  }

  return result.value;
}
