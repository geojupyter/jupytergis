import { Notification } from '@jupyterlab/apputils';
import * as React from 'react';

// KNOWN LIMITATION: the openEO ModelBuilder is loaded from a CDN at runtime.
// `@openeo/vue-components` ships a Vue CLI `wc-async` build (an entry file plus
// ~150 sibling chunks loaded relative to its own script URL), so it cannot be
// cleanly `import`ed through JupyterLab's webpack build. As a result the graph
// editor needs network access and does not work offline / in JupyterLite.
// Potential Follow-up: vendor the prebuilt `assets/` folder into the extension's
// static files and load it from a local URL instead.
const VUE_COMPONENTS_VERSION = '2.23.3';
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@openeo/vue-components@${VUE_COMPONENTS_VERSION}/assets/openeo.js`;

let _bundlePromise: Promise<void> | null = null;

function ensureOpenEOVueBundle(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window not available'));
  }
  if ((window as any).customElements?.get('openeo-model-builder')) {
    return Promise.resolve();
  }
  if (_bundlePromise) {
    return _bundlePromise;
  }
  _bundlePromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-openeo-vue-components="${VUE_COMPONENTS_VERSION}"]`,
    );
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = BUNDLE_URL;
      script.async = true;
      script.dataset.openeoVueComponents = VUE_COMPONENTS_VERSION;
      document.head.appendChild(script);
    }
    const check = () => !!window.customElements?.get('openeo-model-builder');
    if (check()) {
      resolve();
      return;
    }
    script.addEventListener('load', () => {
      const start = Date.now();
      const poll = () => {
        if (check()) {
          resolve();
          return;
        }
        if (Date.now() - start > 10000) {
          reject(new Error('openeo-model-builder not registered after load'));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
    });
    script.addEventListener('error', () =>
      reject(new Error(`Failed to load ${BUNDLE_URL}`)),
    );
  });
  return _bundlePromise;
}

interface IProcessGraphViewProps {
  graph: Record<string, any>;
  editable?: boolean;
  onEdit?: (graph: Record<string, any>) => void;
  /** Backend process registry — gives the editor port types. */
  processes?: any[];
  /** Backend collections — used by the editor for richer node info. */
  collections?: any[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface IntrinsicElements {
      'openeo-model-builder': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

export const ProcessGraphView: React.FC<IProcessGraphViewProps> = ({
  graph,
  editable = false,
  onEdit,
  processes,
  collections,
}) => {
  const onEditRef = React.useRef(onEdit);
  React.useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);
  const [selectionCount, setSelectionCount] = React.useState(0);
  const elementRef = React.useRef<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // mountKey ticks to force the element to be torn down and recreated,
  // which is the only reliable way to get ModelBuilder to re-measure
  // its container after the dialog finishes opening on a cold reload.
  const [mountKey, setMountKey] = React.useState(0);
  // Tracks the graph the element currently reflects (and the mount it was
  // fed on), so we don't re-feed it a value it just emitted — reassigning
  // el.value rebuilds the canvas and resets the user's zoom/pan.
  const lastGraphJsonRef = React.useRef<string | null>(null);
  const lastMountKeyRef = React.useRef<number>(-1);

  React.useEffect(() => {
    let cancelled = false;
    ensureOpenEOVueBundle()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Assign value to the element on each mount.
  React.useEffect(() => {
    const el = elementRef.current as any;
    if (!ready || !el) {
      return;
    }
    const graphJson = JSON.stringify(graph);
    const remounted = lastMountKeyRef.current !== mountKey;
    // Only (re-)feed the element on a remount or an external graph change.
    // Skipping it when `graph` merely echoes the ModelBuilder's own emit
    // keeps the user's zoom/pan intact while editing.
    if (remounted || graphJson !== lastGraphJsonRef.current) {
      el.value = { id: 'jp-openeo-preview', process_graph: graph };
    }
    lastGraphJsonRef.current = graphJson;
    lastMountKeyRef.current = mountKey;
    el.editable = editable;
    // Feeding the backend's process + collection registry gives the
    // ModelBuilder port type labels and lets it validate connections.
    if (processes) {
      el.processes = processes;
    }
    if (collections) {
      el.collections = collections;
    }

    if (!editable) {
      return;
    }

    // ModelBuilder's onKeyDown only treats event.code === 'Delete' as a
    // delete command. On Mac compact keyboards the labeled "delete" key
    // is actually Backspace, so users can't remove edges. Translate
    // Backspace to a synthetic Delete keydown so it works.
    const onBackspace = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.code !== 'Backspace') {
        return;
      }
      const target = e.target as EventTarget;
      const synthetic = new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        bubbles: true,
        cancelable: true,
      });
      e.preventDefault();
      e.stopPropagation();
      target.dispatchEvent(synthetic);
    };
    el.addEventListener('keydown', onBackspace, true);

    const onInput = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const next = Array.isArray(detail) ? detail[0] : detail;
      if (!next) {
        return;
      }
      // ModelBuilder emits either a Process ({id, process_graph}) or a
      // raw process_graph. Normalize to process_graph.
      const pg =
        next && typeof next === 'object' && 'process_graph' in next
          ? next.process_graph
          : next;
      if (pg && typeof pg === 'object') {
        // Record what the element now reflects so the value-sync effect
        // doesn't re-feed it this same graph (which would reset zoom/pan).
        lastGraphJsonRef.current = JSON.stringify(pg);
        onEditRef.current?.(pg as Record<string, any>);
      }
    };
    el.addEventListener('input', onInput);

    // Track selection so we can enable/disable the delete button.
    const onSelectionChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // Vue $emit('selectionChanged', blocks, edges) → CustomEvent.detail
      // is an array [blocks, edges] in the web-component wrapper.
      const arr = Array.isArray(detail) ? detail : [];
      const blocks = Array.isArray(arr[0]) ? arr[0] : [];
      const edges = Array.isArray(arr[1]) ? arr[1] : [];
      setSelectionCount(blocks.length + edges.length);
    };
    el.addEventListener('selectionChanged', onSelectionChanged);

    // ModelBuilder emits 'error' for things like rejected paste, missing
    // result node, paste errors, etc. Surface them as toast notifications
    // instead of letting them swallow silently.
    let lastErrorAt = 0;
    const onModelError = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const arr = Array.isArray(detail) ? detail : [detail];
      const message = String(arr[0] ?? 'OpenEO graph editor reported an error.');
      // Debounce to avoid flooding when an action emits multiple errors
      // in the same tick.
      const now = Date.now();
      if (now - lastErrorAt < 250) {
        return;
      }
      lastErrorAt = now;
      Notification.warning(`OpenEO graph: ${message}`, { autoClose: 4000 });
    };
    el.addEventListener('error', onModelError);

    return () => {
      el.removeEventListener('input', onInput);
      el.removeEventListener('keydown', onBackspace, true);
      el.removeEventListener('selectionChanged', onSelectionChanged);
      el.removeEventListener('error', onModelError);
    };
  }, [graph, ready, mountKey, editable, processes, collections]);

  // Detect when the container becomes properly sized and the SVG inside
  // the ModelBuilder is still empty — force a remount until it draws.
  React.useEffect(() => {
    if (!ready) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    let attempts = 0;
    const maxAttempts = 10;
    let timer: number | null = null;
    const tick = () => {
      attempts += 1;
      const el = elementRef.current as any;
      const blocks = el?.shadowRoot?.querySelector('.blocks');
      const rendered =
        blocks && blocks.children && blocks.children.length > 0;
      const sized = container.clientWidth > 0 && container.clientHeight > 0;
      if (sized && !rendered && attempts < maxAttempts) {
        setMountKey(k => k + 1);
        timer = window.setTimeout(tick, 120);
      } else if (!sized && attempts < maxAttempts) {
        timer = window.setTimeout(tick, 120);
      }
    };
    timer = window.setTimeout(tick, 60);
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
    // Runs on (re)mount only — not on every edit — so editing the graph
    // doesn't retrigger the remount/redraw probe.
  }, [ready, mountKey]);

  if (error) {
    return (
      <div className="jp-openeo-pg-error">
        Failed to load openEO graph viewer: {error}
      </div>
    );
  }

  if (!ready) {
    return <div className="jp-openeo-pg-loading">Loading graph viewer…</div>;
  }

  const onDeleteSelected = () => {
    const el = elementRef.current as any;
    if (!el) {
      return;
    }
    // Vue 2 stores the component instance on the host element via
    // __vue__. Calling its deleteSelected() directly is more reliable
    // than dispatching a synthetic keydown.
    const root = el.shadowRoot?.querySelector(
      '.vue-component.model-builder',
    ) ;
    const vueInst = root?.__vue__;
    if (vueInst && typeof vueInst.deleteSelected === 'function') {
      vueInst.deleteSelected();
      return;
    }
    // Fallback: synthetic keydown.
    (root ?? el).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Delete',
        code: 'Delete',
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  return (
    <div
      className="jp-openeo-pg-canvas"
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      {editable && (
        <button
          type="button"
          className="jp-openeo-pg-delete-btn"
          disabled={selectionCount === 0}
          onClick={onDeleteSelected}
          title={
            selectionCount === 0
              ? 'Select a block or connection to delete'
              : `Delete ${selectionCount} selected`
          }
        >
          🗑 Delete{selectionCount > 0 ? ` (${selectionCount})` : ''}
        </button>
      )}
      {React.createElement('openeo-model-builder', {
        key: mountKey,
        ref: elementRef,
        id: 'jp-openeo-model-builder',
        height: '100%',
        style: { display: 'block', width: '100%', height: '100%' },
      })}
    </div>
  );
};
