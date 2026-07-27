import { Notification } from '@jupyterlab/apputils';
import * as React from 'react';

import { ExportLanguage, exportProcessGraphCode } from './codeExport';

interface ICodeExportPanelProps {
  /** The process graph currently shown in the editor. */
  graph: Record<string, any>;
  /** Server URL to seed the generated `connect(...)` call. */
  serverUrl?: string;
  /** Layer name used in the optional JupyterGIS snippet. */
  layerName?: string;
}

const LANGUAGES: { id: ExportLanguage; label: string; ext: string }[] = [
  { id: 'python', label: 'Python', ext: 'py' },
  { id: 'r', label: 'R', ext: 'R' },
];

/**
 * Read-only view that renders the current process graph as equivalent openeo
 * client code (Python or R), with copy/download and an optional JupyterGIS
 * snippet (Python only).
 */
export const CodeExportPanel: React.FC<ICodeExportPanelProps> = ({
  graph,
  serverUrl,
  layerName,
}) => {
  const [lang, setLang] = React.useState<ExportLanguage>('python');
  const [includeJupyterGIS, setIncludeJupyterGIS] = React.useState(true);

  const code = React.useMemo(
    () =>
      exportProcessGraphCode(graph, lang, {
        serverUrl,
        layerName,
        includeJupyterGIS: lang === 'python' && includeJupyterGIS,
      }),
    [graph, lang, serverUrl, layerName, includeJupyterGIS],
  );

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      Notification.success('Copied code to clipboard.', { autoClose: 1800 });
    } catch (err: any) {
      Notification.error(`Couldn't copy: ${err?.message ?? String(err)}`, {
        autoClose: 4000,
      });
    }
  };

  const onDownload = () => {
    const ext = LANGUAGES.find(l => l.id === lang)?.ext ?? 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (layerName || 'process-graph')
      .replace(/[^a-z0-9-_]+/gi, '-')
      .toLowerCase();
    a.href = url;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="jp-openeo-code-export">
      <div className="jp-openeo-code-export-controls">
        <div className="jp-openeo-segmented">
          {LANGUAGES.map(l => (
            <button
              key={l.id}
              type="button"
              className={lang === l.id ? 'jp-mod-selected' : ''}
              onClick={() => setLang(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        {lang === 'python' && (
          <label className="jp-openeo-code-export-toggle">
            <input
              type="checkbox"
              checked={includeJupyterGIS}
              onChange={e => setIncludeJupyterGIS(e.target.checked)}
            />
            <span>Add to a JupyterGIS document</span>
          </label>
        )}
        <div className="jp-openeo-toolbar-spacer" />
        <button
          type="button"
          className="jp-openeo-toolbar-btn"
          onClick={onCopy}
          title="Copy the generated code to the clipboard"
        >
          Copy
        </button>
        <button
          type="button"
          className="jp-openeo-toolbar-btn"
          onClick={onDownload}
          title="Download the generated code"
        >
          Download
        </button>
      </div>
      <pre className="jp-openeo-graph-preview">{code}</pre>
    </div>
  );
};
