import {
  Dialog,
  Notification,
  ReactWidget,
  showDialog,
} from '@jupyterlab/apputils';
import * as React from 'react';

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
import { IOpenEOConnectionInfo } from '../mainview/OpenEOTileLayer';

export interface IOpenEODialogResult {
  layerName: string;
  serverUrl: string;
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
   * An already-established connection to the OpenEO server. The caller
   * connects (and signs in) before opening the dialog.
   */
  connectionInfo: IOpenEOConnectionInfo;
  onChange: (next: IBodyState) => void;
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

function defaultArgsFromProcess(parameters: any[] | undefined): Record<string, any> {
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

function buildProcessNode(
  procId: string,
  process: any,
): Record<string, any> {
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
                onDragStart={e =>
                  onDragStart(e, { kind: 'process', id: p.id })
                }
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
                onDragStart={e =>
                  onDragStart(e, { kind: 'format', id: f.id })
                }
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
        {subtitle && (
          <span className="jp-openeo-secondary">{subtitle}</span>
        )}
      </span>
    </div>
  );
};

const Form: React.FC<IFormProps> = ({
  initial,
  connectionInfo,
  onChange,
  onValidationChange,
}) => {
  const [state, setState] = React.useState<IBodyState>(initial);

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
          ? (parsed ).process_graph
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

    // Backend pass — debounced.
    const handle = window.setTimeout(async () => {
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
    onValidationChange(
      validation.state === 'valid' && !isChecking && fresh,
    );
  }, [validation, isChecking, onValidationChange]);

  // Fetch backend catalog (processes + collections) so ModelBuilder can
  // label ports with types. Cached, so this is free if the Discovery
  // panel already populated the cache.
  React.useEffect(() => {
    let cancelled = false;
    setCatalog(null);
    setCatalogLoading(true);
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
          `OpenEO: couldn't load the process/collection catalog from ${connectionInfo.url}. The graph editor will still work, but ports won't be type-labeled.`,
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
          <label className="jp-openeo-field">
            <span>Server</span>
            <input
              type="text"
              value={connectionInfo.url ?? ''}
              readOnly
              title="Connected OpenEO server"
            />
          </label>
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
              'jp-openeo-toolbar-toggle' + (editMode ? ' jp-mod-selected' : '')
            }
            onClick={() => setEditMode(v => !v)}
            title="Toggle edit mode for the graph or JSON"
          >
            ✎ Edit
          </button>
          {editMode && viewMode === 'graph' && (
            <>
              <button
                type="button"
                className="jp-openeo-toolbar-btn"
                onClick={callModelBuilder('undo')}
                title="Undo last graph edit (Ctrl/⌘+Z)"
              >
                ↶ Undo
              </button>
              <button
                type="button"
                className="jp-openeo-toolbar-btn"
                onClick={callModelBuilder('redo')}
                title="Redo (Ctrl/⌘+Shift+Z)"
              >
                ↷ Redo
              </button>
            </>
          )}
          {state.editedGraph && (
            <button
              type="button"
              className="jp-openeo-toolbar-btn"
              onClick={resetToTemplate}
              title="Discard edits and rebuild from the selected template"
            >
              ↺ Reset
            </button>
          )}
          <button
            type="button"
            className="jp-openeo-toolbar-btn"
            onClick={onImportClick}
            title="Replace the graph with a JSON file from disk"
          >
            ⤓ Import
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
            className="jp-openeo-toolbar-btn"
            onClick={onExport}
            title="Download the current process graph as JSON"
          >
            ⤒ Export
          </button>
          <div className="jp-openeo-toolbar-spacer" />
          <span
            className={
              'jp-openeo-status ' +
              (validation.state === 'valid'
                ? 'jp-openeo-status-ok'
                : validation.state === 'invalid' ||
                    validation.state === 'error'
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
            Editing is advanced. Click an edge or block then press Backspace
            (or fn+Delete) to remove it. Use Reset to restore the template.
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
    private _connectionInfo: IOpenEOConnectionInfo,
    private _onValidationChange: (valid: boolean) => void,
  ) {
    super();
    this._state = initial;
    this.addClass('jp-openeo-add-layer-body');
  }

  protected render(): JSX.Element {
    return (
      <Form
        initial={this._state}
        connectionInfo={this._connectionInfo}
        onChange={next => {
          this._state = next;
        }}
        onValidationChange={this._onValidationChange}
      />
    );
  }

  getValue(): IOpenEODialogResult | null {
    const template = OPENEO_TEMPLATES.find(
      t => t.id === this._state.templateId,
    );
    if (!template || !this._connectionInfo.url) {
      return null;
    }
    return {
      layerName: this._state.layerName || template.name,
      serverUrl: this._connectionInfo.url,
      processGraph:
        this._state.editedGraph ?? template.buildGraph(this._state.params),
    };
  }

  private _state: IBodyState;
}

export interface IOpenEODialogOptions {
  /**
   * An already-established connection to the OpenEO server. The caller is
   * expected to `connect()` first (showing the sign-in dialog) so the
   * layer dialog can load collections and validate graphs immediately.
   */
  connectionInfo: IOpenEOConnectionInfo;
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
      : 'Process graph has validation errors. Fix them before adding the layer.';
  };
  const body = new AddLayerBody(initial, options.connectionInfo, valid => {
    lastValid = valid;
    applyOk();
  });

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
