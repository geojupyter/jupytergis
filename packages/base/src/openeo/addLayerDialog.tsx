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
import { IValidationError, validateProcessGraph } from './validation';
import { IOpenEOConnectionInfo } from '../mainview/OpenEOTileLayer';

export interface IOpenEODialogResult {
  layerName: string;
  serverUrl: string;
  authBearer?: string;
  processGraph: Record<string, any>;
}

interface IBodyState {
  layerName: string;
  serverUrl: string;
  templateId: string;
  params: IOpenEOTemplateParams;
  // When non-null, the user has hand-edited the graph and we use this
  // instead of recomputing from the template.
  editedGraph: Record<string, any> | null;
}

interface IFormProps {
  initial: IBodyState;
  /**
   * Shared, mutable connection info. `serverUrl` edits update `url`; the
   * `connect` helper populates `authBearer` once the user authenticates.
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

  // Debounced backend validation against POST /validation. Keyed by the
  // graph's JSON content (not object identity) so it only re-runs when
  // the user actually changes the graph.
  const [validation, setValidation] = React.useState<ValidationStatus>({
    state: 'idle',
  });
  React.useEffect(() => {
    if (!state.serverUrl) {
      setValidation({ state: 'idle' });
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      if (cancelled) {
        return;
      }
      setValidation({ state: 'pending' });
      try {
        const parsed = JSON.parse(effectiveGraphJson);
        const errors = await validateProcessGraph(connectionInfo, parsed);
        if (cancelled) {
          return;
        }
        if (errors.length === 0) {
          setValidation({ state: 'valid' });
        } else {
          setValidation({ state: 'invalid', errors });
        }
      } catch (err: any) {
        if (cancelled) {
          return;
        }
        setValidation({
          state: 'error',
          message: err?.message ?? String(err),
        });
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [effectiveGraphJson, state.serverUrl, connectionInfo]);

  React.useEffect(() => {
    onValidationChange(validation.state === 'valid');
  }, [validation, onValidationChange]);

  // Fetch backend catalog (processes + collections) so ModelBuilder can
  // label ports with types. Cached, so this is free if the Discovery
  // panel already populated the cache.
  const [catalog, setCatalog] = React.useState<IBackendCatalog | null>(null);
  React.useEffect(() => {
    if (!state.serverUrl) {
      setCatalog(null);
      return;
    }
    let cancelled = false;
    setCatalog(null);
    fetchBackendCatalog(connectionInfo)
      .then(c => {
        if (!cancelled) {
          setCatalog(c);
        }
      })
      .catch(err => {
        if (cancelled) {
          return;
        }
        Notification.warning(
          `OpenEO: couldn't load process/collection catalog from ${state.serverUrl}. The graph editor will still work, but ports won't be type-labeled.`,
          { autoClose: 4000 },
        );
        // eslint-disable-next-line no-console
        console.warn('OpenEO catalog fetch failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [state.serverUrl, connectionInfo]);

  return (
    <div className="jp-openeo-dialog">
      <div className="jp-openeo-dialog-left">
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
            <span>Server URL</span>
            <input
              type="text"
              placeholder="https://openeo.example.org"
              value={state.serverUrl}
              onChange={e => {
                const v = e.target.value;
                // Keep the shared connection info in sync; a new server
                // means any previously acquired token no longer applies.
                connectionInfo.url = v;
                connectionInfo.authBearer = undefined;
                update({ serverUrl: v });
              }}
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
            <span>Start (ISO)</span>
            <input
              type="text"
              value={state.params.temporalExtent[0]}
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
            <span>End (ISO)</span>
            <input
              type="text"
              value={state.params.temporalExtent[1]}
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
        <div className="jp-openeo-canvas-wrapper">
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
    if (!template || !this._state.serverUrl) {
      return null;
    }
    return {
      layerName: this._state.layerName || template.name,
      serverUrl: this._state.serverUrl,
      authBearer: this._connectionInfo.authBearer,
      processGraph:
        this._state.editedGraph ?? template.buildGraph(this._state.params),
    };
  }

  private _state: IBodyState;
}

export interface IOpenEODialogOptions {
  /** Pre-fill server URL (e.g. when editing an existing layer). */
  serverUrl?: string;
  /** Pre-fill the session bearer token. */
  authBearer?: string;
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
  options: IOpenEODialogOptions = {},
): Promise<IOpenEODialogResult | null> {
  const firstTemplate = OPENEO_TEMPLATES[0];
  const initial: IBodyState = {
    layerName: options.layerName ?? firstTemplate.name,
    serverUrl: options.serverUrl ?? '',
    templateId: firstTemplate.id,
    params: { ...firstTemplate.defaults },
    editedGraph: options.initialGraph ?? null,
  };

  // Shared, mutable connection info threaded through the form. The
  // `connect` helper populates `authBearer` after the user signs in.
  const connectionInfo: IOpenEOConnectionInfo = {
    url: options.serverUrl,
    authBearer: options.authBearer,
  };

  const body = new AddLayerBody(initial, connectionInfo, _valid => {
    // Validation feedback is inline; we don't gate accept yet.
  });

  const result = await showDialog<IOpenEODialogResult | null>({
    title: options.title ?? 'Add OpenEO Layer',
    body,
    buttons: [
      Dialog.cancelButton(),
      Dialog.okButton({ label: options.okLabel ?? 'Add Layer' }),
    ],
  });

  if (!result.button.accept) {
    return null;
  }
  return result.value ?? null;
}
