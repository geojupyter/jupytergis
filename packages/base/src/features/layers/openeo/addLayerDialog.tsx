import {
  Dialog,
  Notification,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import * as React from 'react';

import {
  connect as openEOConnect,
  IOpenEOConnectionInfo,
  listOpenEOConnections,
} from './OpenEOTileLayer';
import { fetchBackendCatalog, IBackendCatalog } from './backendCatalog';
import { JsonEditor } from './jsonEditor';
import { ProcessGraphView } from './processGraphView';
import {
  IOpenEOTemplate,
  IOpenEOTemplateParams,
  OPENEO_TEMPLATES,
} from './templates';
import {
  IValidationError,
  mergeValidationErrors,
  validateProcessGraph,
  validateProcessGraphLocally,
} from './validation';

export interface IOpenEODialogResult {
  layerName: string;
  serverUrl: string;
  authBearer?: string;
  processGraph: Record<string, any>;
}

interface IBodyState {
  layerName: string;
  templateId: string;
  params: IOpenEOTemplateParams;
  // When non-null, the user has hand-edited the graph and we use this
  // instead of recomputing from the template.
  editedGraph: Record<string, any> | null;
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
  onChange: (next: IBodyState) => void;
  onActiveServerChange: (info: IOpenEOConnectionInfo | null) => void;
  onValidationChange: (valid: boolean) => void;
}

type ValidationStatus =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'valid' }
  | { state: 'invalid'; errors: IValidationError[] }
  | { state: 'error'; message: string };

const DRAG_MIME = 'application/x-openeo-node';

type DragPayload =
  | { kind: 'collection'; id: string }
  | { kind: 'process'; id: string }
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

function buildCollectionNode(
  id: string,
  params: IOpenEOTemplateParams,
): Record<string, any> {
  return {
    process_id: 'load_collection',
    arguments: {
      id,
      bands: [],
      properties: {},
      spatial_extent: params.bbox,
      temporal_extent: params.temporalExtent,
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
  outputFormats: any[] | undefined;
  loading: boolean;
  onBack: () => void;
}

const CatalogPalette: React.FC<ICatalogPaletteProps> = ({
  collections,
  processes,
  outputFormats,
  loading,
  onBack,
}) => {
  const [filter, setFilter] = React.useState('');
  const [openCollections, setOpenCollections] = React.useState(true);
  const [openProcesses, setOpenProcesses] = React.useState(false);
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
}> = ({ id, subtitle, onDragStart }) => {
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
    </div>
  );
};

const Form: React.FC<IFormProps> = ({
  initial,
  initialConnection,
  knownServers,
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
  const [serverUsername, setServerUsername] = React.useState('');
  const [serverPassword, setServerPassword] = React.useState('');
  // Server section has three explicit modes: pick/enter a URL, enter
  // credentials, or already connected. Credentials inputs are only
  // visible in 'signin' so they don't clutter the dialog when not
  // needed.
  type ServerMode = 'select' | 'signin' | 'connected';
  const [serverMode, setServerMode] = React.useState<ServerMode>(() =>
    connectionInfo?.url ? 'connected' : 'select',
  );
  const usernameRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (serverMode === 'signin') {
      // Defer to next tick so the input is mounted before we focus.
      window.setTimeout(() => usernameRef.current?.focus(), 0);
    }
  }, [serverMode]);

  const setConnectionInfo = (next: IOpenEOConnectionInfo | null) => {
    setConnectionInfoState(next);
    onActiveServerChange(next);
  };

  const update = (patch: Partial<IBodyState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(next);
  };

  const template =
    OPENEO_TEMPLATES.find(t => t.id === state.templateId) ??
    OPENEO_TEMPLATES[0];

  // Prompt before discarding user edits when changing template/params.
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

  const onTemplate = (t: IOpenEOTemplate) => {
    guardReseed(() =>
      update({
        templateId: t.id,
        params: { ...t.defaults },
        editedGraph: null,
      }),
    );
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
    // Reuse cached creds if user retries the same URL.
    setServerMode('signin');
  };

  // Step 2: user submits credentials. Calls connect() with the inline
  // signIn payload so it doesn't try to open a nested sign-in dialog
  // (JupyterLab queues those behind the currently-open dialog).
  const onLogin = async () => {
    const raw = serverInput.trim();
    if (!raw) {
      setServerError('Enter an OpenEO server URL.');
      return;
    }
    if (!serverUsername || !serverPassword) {
      setServerError('Enter username and password.');
      return;
    }
    setServerBusy(true);
    setServerError(null);
    const next: IOpenEOConnectionInfo = {
      url: raw,
      signIn: {
        serverUrl: raw,
        username: serverUsername,
        password: serverPassword,
      },
    };
    try {
      await openEOConnect(next);
    } catch (err: any) {
      setServerError(err?.message ?? String(err));
      setServerBusy(false);
      return;
    }
    // connect() may normalize the url (e.g. add https://) — reflect
    // that back so downstream references match.
    const resolved = next.url ?? raw;
    setServerInput(resolved);
    setServers(prev => (prev.includes(resolved) ? prev : [...prev, resolved]));
    setConnectionInfo(next);
    setServerPassword('');
    setServerBusy(false);
    setServerMode('connected');
  };

  const onChangeServer = () => {
    setServerError(null);
    setServerBusy(false);
    setServerMode('select');
  };

  const updateBbox = (key: keyof IBodyState['params']['bbox'], v: string) => {
    const num = parseFloat(v);
    guardReseed(() =>
      update({
        params: {
          ...state.params,
          bbox: { ...state.params.bbox, [key]: isNaN(num) ? 0 : num },
        },
        editedGraph: null,
      }),
    );
  };

  // Memoize the graph so its identity only changes when the contents
  // actually change. Otherwise every render produces a new object,
  // re-firing validation and reassigning ModelBuilder.value mid-edit.
  const effectiveGraph = React.useMemo(() => {
    return state.editedGraph ?? template.buildGraph(state.params);
  }, [state.editedGraph, state.templateId, state.params]);
  const effectiveGraphJson = React.useMemo(
    () => JSON.stringify(effectiveGraph, null, 2),
    [effectiveGraph],
  );
  const [viewMode, setViewMode] = React.useState<'graph' | 'json'>('graph');
  const [editMode, setEditMode] = React.useState(false);
  // Local JSON buffer so the user can type freely; on valid parse, push
  // back to state.editedGraph. Reseeded whenever effectiveGraph changes
  // from outside (template/param change, reset).
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

  const resetToTemplate = () => {
    update({ editedGraph: null });
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

    // Local pass — runs immediately so the user sees structural errors
    // (missing required args, wrong argument types, etc) without waiting
    // for the network. Stored in a ref so the backend pass can merge.
    localErrorsRef.current = [];
    validateProcessGraphLocally(parsed, catalog?.processes).then(local => {
      if (versionRef.current !== myVersion) {
        return;
      }
      localErrorsRef.current = local;
      // Optimistic apply: show local results right away. The backend
      // pass will overwrite with the merged set when it lands.
      setValidation(
        local.length === 0
          ? { state: 'valid' }
          : { state: 'invalid', errors: local },
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
        backendErrors = await validateProcessGraph(connectionInfo, parsed);
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
        result = { state: 'invalid', errors: merged };
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
  }, [effectiveGraphJson, connectionInfo, catalog?.processes]);

  React.useEffect(() => {
    const fresh = lastResultVersionRef.current === versionRef.current;
    // Adding a layer also requires a live connection: the source needs a
    // serverUrl to resolve its in-memory connection at tile-load time.
    onValidationChange(
      Boolean(connectionInfo?.url) &&
        validation.state === 'valid' &&
        !isChecking &&
        fresh,
    );
  }, [validation, isChecking, connectionInfo, onValidationChange]);

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
  }, [connectionInfo]);

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
    const base = state.editedGraph ?? template.buildGraph(state.params);
    const existing = new Set(Object.keys(base));
    let node: Record<string, any>;
    let procId: string;
    if (payload.kind === 'collection') {
      procId = 'load_collection';
      node = buildCollectionNode(payload.id, state.params);
    } else if (payload.kind === 'format') {
      procId = 'save_result';
      node = buildSaveResultNode(payload.id);
    } else {
      procId = payload.id;
      const proc = (catalog?.processes ?? []).find(
        (p: any) => p?.id === payload.id,
      );
      node = buildProcessNode(payload.id, proc);
    }
    const key = mintNodeKey(procId, existing);
    const nextGraph = { ...base, [key]: node };
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
          payload.kind === 'format')
      ) {
        insertNode(payload);
      }
    } catch {
      // Bad payload — ignore.
    }
  };

  return (
    <div className="jp-openeo-dialog">
      <div className="jp-openeo-dialog-left">
        {editMode ? (
          <CatalogPalette
            collections={catalog?.collections}
            processes={catalog?.processes}
            outputFormats={catalog?.outputFormats}
            loading={catalogLoading}
            onBack={() => setEditMode(false)}
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
                {serverMode === 'connected' && (
                  <div className="jp-openeo-server-connected">
                    <span className="jp-openeo-server-ok">✓</span>
                    <code>{connectionInfo?.url}</code>
                    <button
                      type="button"
                      className="jp-openeo-link-btn"
                      onClick={onChangeServer}
                    >
                      Change server
                    </button>
                  </div>
                )}

                {serverMode === 'select' && (
                  <>
                    <label className="jp-openeo-field">
                      <span>Server URL</span>
                      <div className="jp-openeo-server-picker">
                        <input
                          type="text"
                          list="jp-openeo-known-servers"
                          placeholder="https://openeo.example.org"
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
                )}

                {serverMode === 'signin' && (
                  <>
                    <div className="jp-openeo-signin-header">
                      Sign in to <code>{serverInput.trim()}</code>
                      <button
                        type="button"
                        className="jp-openeo-link-btn"
                        onClick={onChangeServer}
                        disabled={serverBusy}
                      >
                        Change server
                      </button>
                    </div>
                    {serverError && (
                      <div className="jp-openeo-server-alert jp-mod-error">
                        {serverError}
                      </div>
                    )}
                    <label className="jp-openeo-field">
                      <span>Username</span>
                      <input
                        ref={usernameRef}
                        type="text"
                        autoComplete="username"
                        value={serverUsername}
                        onChange={e => setServerUsername(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void onLogin();
                          }
                        }}
                        disabled={serverBusy}
                      />
                    </label>
                    <label className="jp-openeo-field">
                      <span>Password</span>
                      <input
                        type="password"
                        autoComplete="current-password"
                        value={serverPassword}
                        onChange={e => setServerPassword(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void onLogin();
                          }
                        }}
                        disabled={serverBusy}
                      />
                    </label>
                    <div className="jp-openeo-signin-actions">
                      <button
                        type="button"
                        className="jp-openeo-server-connect"
                        onClick={onLogin}
                        disabled={
                          serverBusy || !serverUsername || !serverPassword
                        }
                      >
                        {serverBusy ? 'Signing in…' : 'Log in'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="jp-openeo-section">
              <h4>Template</h4>
              <div className="jp-openeo-template-pills">
                {OPENEO_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={
                      'jp-openeo-pill' +
                      (t.id === state.templateId ? ' jp-mod-selected' : '')
                    }
                    onClick={() => onTemplate(t)}
                    title={t.description}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <p className="jp-openeo-section-help">{template.description}</p>
            </section>

            <section className="jp-openeo-section">
              <h4>Region &amp; time</h4>
              <label className="jp-openeo-field">
                <span>Collection</span>
                <input
                  type="text"
                  value={state.params.collectionId}
                  onChange={e => {
                    const v = e.target.value;
                    guardReseed(() =>
                      update({
                        params: { ...state.params, collectionId: v },
                        editedGraph: null,
                      }),
                    );
                  }}
                />
              </label>
              <div className="jp-openeo-bbox-grid">
                <label>
                  <span>West</span>
                  <input
                    type="number"
                    step="0.001"
                    value={state.params.bbox.west}
                    onChange={e => updateBbox('west', e.target.value)}
                  />
                </label>
                <label>
                  <span>East</span>
                  <input
                    type="number"
                    step="0.001"
                    value={state.params.bbox.east}
                    onChange={e => updateBbox('east', e.target.value)}
                  />
                </label>
                <label>
                  <span>South</span>
                  <input
                    type="number"
                    step="0.001"
                    value={state.params.bbox.south}
                    onChange={e => updateBbox('south', e.target.value)}
                  />
                </label>
                <label>
                  <span>North</span>
                  <input
                    type="number"
                    step="0.001"
                    value={state.params.bbox.north}
                    onChange={e => updateBbox('north', e.target.value)}
                  />
                </label>
              </div>
              <label className="jp-openeo-field">
                <span>Start date</span>
                <input
                  type="date"
                  value={(state.params.temporalExtent[0] ?? '').slice(0, 10)}
                  onChange={e => {
                    const v = e.target.value;
                    guardReseed(() =>
                      update({
                        params: {
                          ...state.params,
                          temporalExtent: [v, state.params.temporalExtent[1]],
                        },
                        editedGraph: null,
                      }),
                    );
                  }}
                />
              </label>
              <label className="jp-openeo-field">
                <span>End date</span>
                <input
                  type="date"
                  value={(state.params.temporalExtent[1] ?? '').slice(0, 10)}
                  onChange={e => {
                    const v = e.target.value;
                    guardReseed(() =>
                      update({
                        params: {
                          ...state.params,
                          temporalExtent: [state.params.temporalExtent[0], v],
                        },
                        editedGraph: null,
                      }),
                    );
                  }}
                />
              </label>
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
          </div>
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
          {state.editedGraph && (
            <button
              type="button"
              className="jp-openeo-toolbar-btn jp-openeo-icon-btn"
              onClick={resetToTemplate}
              title="Reset: discard edits and rebuild from the selected template"
              aria-label="Reset to template"
            >
              ↺
            </button>
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
          <div className="jp-openeo-toolbar-spacer" />
          <span
            className={
              'jp-openeo-status ' +
              (validation.state === 'valid'
                ? 'jp-openeo-status-ok'
                : validation.state === 'invalid' || validation.state === 'error'
                  ? 'jp-openeo-status-bad'
                  : 'jp-openeo-status-pending')
            }
            title={
              validation.state === 'error' ? validation.message : undefined
            }
          >
            {state.editedGraph && <span className="jp-openeo-dot">●</span>}
            {isChecking && (
              <span className="jp-openeo-spinner" aria-label="Re-checking">
                ⟳
              </span>
            )}
            {validation.state === 'pending' && 'checking schema…'}
            {validation.state === 'valid' && 'schema OK'}
            {validation.state === 'invalid' &&
              `${validation.errors.length} schema issue${validation.errors.length === 1 ? '' : 's'}`}
            {validation.state === 'error' && "couldn't reach validator"}
            {validation.state === 'idle' && ' '}
          </span>
        </div>
        {editMode && (
          <p className="jp-openeo-edit-hint-inline">
            Editing is advanced. Click an edge or block then press Backspace (or
            fn+Delete) to remove it. Use Reset to restore the template.
          </p>
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
          {viewMode === 'json' ? (
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
        {validation.state === 'invalid' && (
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
    const template = OPENEO_TEMPLATES.find(
      t => t.id === this._state.templateId,
    );
    if (!template || !this._activeConnection?.url) {
      return null;
    }
    return {
      layerName: this._state.layerName || template.name,
      serverUrl: this._activeConnection.url,
      authBearer: this._activeConnection.authBearer,
      processGraph:
        this._state.editedGraph ?? template.buildGraph(this._state.params),
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
  /** Pre-fill graph as a user edit (skips template fields' effect). */
  initialGraph?: Record<string, any>;
  /** Pre-fill layer name. */
  layerName?: string;
  /** Dialog title. */
  title?: string;
  /** OK button label. */
  okLabel?: string;
}

export async function showAddOpenEOLayerDialog(
  options: IOpenEODialogOptions,
): Promise<IOpenEODialogResult | null> {
  const firstTemplate = OPENEO_TEMPLATES[0];
  const initial: IBodyState = {
    layerName: options.layerName ?? firstTemplate.name,
    templateId: firstTemplate.id,
    params: { ...firstTemplate.defaults },
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
  );

  const resultPromise = showDialog<IOpenEODialogResult | null>({
    title: options.title ?? 'Add OpenEO Layer',
    body,
    buttons: [
      Dialog.cancelButton(),
      Dialog.okButton({ label: options.okLabel ?? 'Add Layer' }),
    ],
  });
  // Apply the initial disabled state once the dialog mounts.
  window.setTimeout(applyOk, 0);
  const result = await resultPromise;

  if (!result.button.accept) {
    return null;
  }
  return result.value ?? null;
}
