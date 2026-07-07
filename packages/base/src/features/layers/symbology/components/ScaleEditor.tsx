/**
 * Inline scale editor for one IMapping.
 * Renders a different UI for each scale scheme.
 */

import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import {
  ClassificationMode,
  ICategoricalScale,
  IColorRampScale,
  IConstantNumScale,
  IConstantRGBAScale,
  IExpressionScale,
  IScale,
  IScalarScale,
  RGBA,
} from '@jupytergis/schema';
import { jupyterTheme } from '@jupyterlab/codemirror';
import { UUID } from '@lumino/coreutils';
import { py2vega } from 'py2vega-ts';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { vega2ol } from 'vega2ol';

import { ColorRampName } from '@/src/features/layers/symbology/colorRampUtils';
import { NumericInput } from '@/src/features/layers/symbology/components/NumericInput';
import ColorRampSelector from '@/src/features/layers/symbology/components/color_ramp/ColorRampSelector';
import RgbaColorPicker, {
  RgbaColor,
} from '@/src/features/layers/symbology/components/color_ramp/RgbaColorPicker';
import StopContainer from '@/src/features/layers/symbology/components/color_stops/StopContainer';
import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  IComputedStop,
} from '@/src/features/layers/symbology/styleBuilder';
import { IStopRow } from '@/src/features/layers/symbology/symbologyDialog';
import { InfoTip } from '@/src/shared/components/InfoTip';

function stopsToRows(
  stops: Array<{ stop: number | string; color: RGBA }>,
): IStopRow[] {
  return stops.map(s => ({
    id: UUID.uuid4(),
    stop: s.stop,
    output: s.color as RgbaColor,
  }));
}

function rowsToColorStops(
  rows: IStopRow[],
): Array<{ stop: number | string; color: RGBA }> {
  return rows
    .filter(r => r.output !== undefined)
    .map(r => ({ stop: r.stop, color: r.output as RGBA }));
}

const MODE_OPTIONS: ClassificationMode[] = [
  'equal interval',
  'quantile',
  'jenks',
  'pretty',
  'logarithmic',
];

// ---------------------------------------------------------------------------
// Constant editor
// ---------------------------------------------------------------------------

interface IConstantEditorProps {
  scale: IConstantRGBAScale | IConstantNumScale;
  onChange: (scale: IScale) => void;
}

export const ConstantEditor: React.FC<IConstantEditorProps> = ({
  scale,
  onChange,
}) => {
  if (scale.scheme === 'constant_num') {
    return (
      <div className="jp-gis-symbology-row">
        <label>Value</label>
        <NumericInput
          className="jp-mod-styled"
          value={scale.params.value}
          onChange={v =>
            onChange({ scheme: 'constant_num', params: { value: v } })
          }
        />
      </div>
    );
  }

  return (
    <div className="jp-gis-symbology-row">
      <label>Color</label>
      <RgbaColorPicker
        color={scale.params.value as RgbaColor}
        onChange={color =>
          onChange({ scheme: 'constant_rgba', params: { value: color } })
        }
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// ColorRamp editor
// ---------------------------------------------------------------------------

interface IColorRampEditorProps {
  scale: IColorRampScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const ColorRampEditor: React.FC<IColorRampEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;
  const [stopRows, setStopRows] = useState<IStopRow[]>(
    params.colorStops ? stopsToRows(params.colorStops) : [],
  );

  const update = useCallback(
    (patch: Partial<IColorRampScale['params']>) =>
      onChange({ scheme: 'colorRamp', params: { ...params, ...patch } }),
    [params, onChange],
  );

  // Auto-populate domain from data when the field is known and domain is unset.
  useEffect(() => {
    if (!field || params.domain) {
      return;
    }
    const values = Array.from(featureValues[field] ?? []).filter(
      (v): v is number => Number.isFinite(v),
    );
    if (values.length === 0) {
      return;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min !== max) {
      update({ domain: [min, max] });
    }
  }, [field, featureValues]); // intentionally omits `update` to avoid loop

  const classify = () => {
    if (!field) {
      return;
    }
    const values = Array.from(featureValues[field] ?? []).filter(
      (v): v is number => Number.isFinite(v),
    );
    const computed: IComputedStop[] = computeGraduatedColorStops(
      {
        renderType: 'Graduated',
        nClasses: params.nShades,
        mode: params.mode as any,
        colorRamp: params.name,
        reverseRamp: params.reverse,
        vmin: params.domain?.[0],
        vmax: params.domain?.[1],
      } as any,
      values,
    );
    const rows = computed.map(s => ({
      id: UUID.uuid4(),
      stop: s.value as number,
      output: s.color as RgbaColor,
    }));
    setStopRows(rows);
    update({
      colorStops: computed.map(s => ({
        stop: s.value as number,
        color: s.color as RGBA,
      })),
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({
      colorStops: rowsToColorStops(rows) as Array<{
        stop: number;
        color: RGBA;
      }>,
    });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Color map</label>
        <ColorRampSelector
          selectedRamp={params.name as ColorRampName}
          setSelected={name => update({ name })}
          reverse={params.reverse}
          setReverse={v =>
            update({ reverse: typeof v === 'function' ? v(params.reverse) : v })
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Mode</label>
        <div className="jp-select-wrapper">
          <select
            className="jp-mod-styled"
            value={params.mode}
            onChange={e =>
              update({ mode: e.target.value as ClassificationMode })
            }
          >
            {MODE_OPTIONS.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Classes</label>
        <NumericInput
          className="jp-mod-styled"
          value={params.nShades}
          onChange={v => update({ nShades: v })}
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Domain</label>
        <div className="jp-gis-domain-inputs">
          <NumericInput
            className="jp-mod-styled"
            placeholder="min"
            value={params.domain?.[0] ?? 0}
            onChange={v => update({ domain: [v, params.domain?.[1] ?? v] })}
          />
          <NumericInput
            className="jp-mod-styled"
            placeholder="max"
            value={params.domain?.[1] ?? 0}
            onChange={v => update({ domain: [params.domain?.[0] ?? v, v] })}
          />
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Fallback</label>
        <RgbaColorPicker
          color={params.fallback as RgbaColor}
          onChange={color => update({ fallback: color as RGBA })}
        />
      </div>
      <button
        className="jp-gis-grammar-action-btn"
        disabled={!field}
        onClick={classify}
      >
        Classify
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="color"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Categorical editor
// ---------------------------------------------------------------------------

interface ICategoricalEditorProps {
  scale: ICategoricalScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const CategoricalEditor: React.FC<ICategoricalEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;

  const initialRows: IStopRow[] = params.colorStops
    ? stopsToRows(params.colorStops)
    : [];
  const [stopRows, setStopRows] = useState<IStopRow[]>(initialRows);

  const update = useCallback(
    (patch: Partial<ICategoricalScale['params']>) =>
      onChange({ scheme: 'categorical', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const classify = () => {
    if (!field) {
      return;
    }
    const values = Array.from(featureValues[field] ?? []);
    const computed: IComputedStop[] = computeCategorizedColorStops(
      {
        renderType: 'Categorized',
        colorRamp: params.colorRamp,
        reverseRamp: params.reverse ?? false,
      } as any,
      values,
    );
    const rows = computed.map(s => ({
      id: UUID.uuid4(),
      stop: s.value as string | number,
      output: s.color as RgbaColor,
    }));
    setStopRows(rows);
    update({
      colorStops: computed.map(s => ({
        stop: s.value as string | number,
        color: s.color as RGBA,
      })),
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({ colorStops: rowsToColorStops(rows) });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Ramp</label>
        <ColorRampSelector
          selectedRamp={params.colorRamp as ColorRampName}
          setSelected={colorRamp => update({ colorRamp })}
          reverse={params.reverse ?? false}
          setReverse={v =>
            update({
              reverse: typeof v === 'function' ? v(params.reverse ?? false) : v,
            })
          }
        />
      </div>
      <div className="jp-gis-symbology-row">
        <label>Fallback</label>
        <RgbaColorPicker
          color={params.fallback as RgbaColor}
          onChange={color => update({ fallback: color as RGBA })}
        />
      </div>
      <button
        className="jp-gis-grammar-action-btn"
        disabled={!field}
        onClick={classify}
      >
        Classify
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="color"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Expression editor
// ---------------------------------------------------------------------------

interface IExpressionEditorProps {
  scale: IExpressionScale;
  onChange: (scale: IScale) => void;
}

export const ExpressionEditor: React.FC<IExpressionEditorProps> = ({
  scale,
  onChange,
}) => {
  const { params } = scale;
  const language = params.language ?? 'vega';

  const update = useCallback(
    (patch: Partial<IExpressionScale['params']>) =>
      onChange({ scheme: 'expression', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const paramsRef = useRef(params);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageComp = useRef(new Compartment()).current;
  const placeholderComp = useRef(new Compartment()).current;

  const [validationError, setValidationError] = useState<string | null>(null);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const VEGA_PLACEHOLDER = "e.g. datum.value > 10 ? 'red' : 'blue'";
  const PYTHON_PLACEHOLDER = "e.g. 'red' if datum.value > 10 else 'blue'";

  const validate = useCallback((expr: string, lang: 'vega' | 'python') => {
    if (!expr.trim()) {
      setValidationError(null);
      return;
    }
    try {
      const vegaExpr = lang === 'python' ? py2vega(expr) : expr;
      vega2ol(vegaExpr as string);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: params.expr || '',
      extensions: [
        languageComp.of(language === 'python' ? python() : javascript()),
        placeholderComp.of(
          placeholder(
            language === 'python' ? PYTHON_PLACEHOLDER : VEGA_PLACEHOLDER,
          ),
        ),
        jupyterTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of(updateView => {
          if (updateView.docChanged) {
            const value = updateView.state.doc.toString();
            onChange({
              scheme: 'expression',
              params: { ...paramsRef.current, expr: value },
            });

            clearTimeout(validationTimerRef.current);
            validationTimerRef.current = setTimeout(() => {
              validate(value, paramsRef.current.language ?? 'vega');
            }, 400);
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    });

    validate(params.expr || '', language);

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: [
        languageComp.reconfigure(
          language === 'python' ? python() : javascript(),
        ),
        placeholderComp.reconfigure(
          placeholder(
            language === 'python' ? PYTHON_PLACEHOLDER : VEGA_PLACEHOLDER,
          ),
        ),
      ],
    });
    validate(params.expr || '', language);
  }, [language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const current = view.state.doc.toString();
    if (current !== params.expr) {
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: params.expr,
        },
      });
    }
  }, [params.expr]);

  const setLanguage = (lang: 'vega' | 'python') => {
    if (lang !== language) {
      update({ language: lang });
    }
  };

  const infoTipContent =
    language === 'python'
      ? {
          text: `Write a Python expression; ${PYTHON_PLACEHOLDER}`,
          syntaxHint: (
            <>
              Use Python conditional syntax: <code>a if condition else b</code>
            </>
          ),
          extraHint: (
            <>
              Transpiled to Vega expressions, so Vega functions and constants
              are also available
            </>
          ),
          docsLink: (
            <a
              href="https://vega.github.io/vega/docs/expressions/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {' '}
              Full Vega Expression Docs
            </a>
          ),
        }
      : {
          text: `Write a Vega expression; ${VEGA_PLACEHOLDER}`,
          syntaxHint: (
            <>
              Use ternary logic: <code>condition ? a : b</code>
            </>
          ),
          extraHint: null,
          docsLink: (
            <a
              href="https://vega.github.io/vega/docs/expressions/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {' '}
              Full Vega Expression Docs
            </a>
          ),
        };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            role="tablist"
            aria-label="Expression language"
            style={{
              display: 'inline-flex',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            {(['vega', 'python'] as const).map(lang => (
              <button
                key={lang}
                role="tab"
                aria-selected={language === lang}
                onClick={() => setLanguage(lang)}
                style={{
                  padding: '2px 8px',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    language === lang
                      ? 'var(--jp-layout-color2)'
                      : 'transparent',
                  color: 'var(--jp-ui-font-color1)',
                  fontWeight: language === lang ? 600 : 400,
                }}
              >
                {lang === 'vega' ? 'Vega' : 'Python'}
              </button>
            ))}
          </span>
          <InfoTip text={infoTipContent.text}>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>
                Access fields with <code>datum.fieldName</code>
              </li>
              <li>{infoTipContent.syntaxHint}</li>
              {infoTipContent.extraHint && <li>{infoTipContent.extraHint}</li>}
              <li>Warning: This is a feature preview.</li>
            </ul>
            {infoTipContent.docsLink}
          </InfoTip>
        </label>
        <div
          style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto' }}
        >
          <div
            ref={editorRef}
            style={{
              flex: '1 1 auto',
              height: 80,
              border: `1px solid ${
                validationError
                  ? 'var(--jp-error-color1)'
                  : 'var(--jp-border-color2)'
              }`,
              borderRadius: 4,
              overflow: 'auto',
            }}
          />
          {validationError && (
            <div
              role="alert"
              style={{
                color: 'var(--jp-error-color1)',
                fontSize: 'var(--jp-ui-font-size0)',
                marginTop: 4,
              }}
            >
              {validationError}
            </div>
          )}
        </div>
      </div>

      <div className="jp-gis-symbology-row">
        <label>Fallback</label>
        {Array.isArray(params.fallback) ? (
          <RgbaColorPicker
            color={params.fallback as RgbaColor}
            onChange={color => update({ fallback: color as RGBA })}
          />
        ) : (
          <NumericInput
            className="jp-mod-styled"
            value={params.fallback}
            onChange={v => update({ fallback: v })}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scalar editor
// ---------------------------------------------------------------------------

interface IScalarEditorProps {
  scale: IScalarScale;
  field: string | undefined;
  featureValues: Record<string, Set<any>>;
  onChange: (scale: IScale) => void;
}

export const ScalarEditor: React.FC<IScalarEditorProps> = ({
  scale,
  field,
  featureValues,
  onChange,
}) => {
  const { params } = scale;

  const update = useCallback(
    (patch: Partial<IScalarScale['params']>) =>
      onChange({ scheme: 'scalar', params: { ...params, ...patch } }),
    [params, onChange],
  );

  const [stopRows, setStopRows] = useState<IStopRow[]>(
    params.scalarStops
      ? params.scalarStops.map(s => ({
          id: UUID.uuid4(),
          stop: s.stop,
          output: s.output,
        }))
      : [],
  );

  const classify = () => {
    const inMin = params.domain[0];
    const inMax = params.domain[1];
    const outMin = params.range[0];
    const outMax = params.range[1];
    const rows: IStopRow[] = [
      { id: UUID.uuid4(), stop: inMin, output: outMin },
      { id: UUID.uuid4(), stop: inMax, output: outMax },
    ];
    setStopRows(rows);
    update({
      scalarStops: [
        { stop: inMin, output: outMin },
        { stop: inMax, output: outMax },
      ],
    });
  };

  const handleStopRowsChange = (rows: IStopRow[]) => {
    setStopRows(rows);
    update({
      scalarStops: rows.map(r => ({
        stop: r.stop as number,
        output: r.output as number,
      })),
    });
  };

  return (
    <div className="jp-gis-color-ramp-container">
      <div className="jp-gis-symbology-row">
        <label>Input range</label>
        <div className="jp-gis-domain-inputs">
          <NumericInput
            className="jp-mod-styled"
            placeholder="min"
            value={params.domain[0]}
            onChange={v => update({ domain: [v, params.domain[1]] })}
          />
          <NumericInput
            className="jp-mod-styled"
            placeholder="max"
            value={params.domain[1]}
            onChange={v => update({ domain: [params.domain[0], v] })}
          />
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Output range</label>
        <div className="jp-gis-domain-inputs">
          <NumericInput
            className="jp-mod-styled"
            placeholder="min"
            value={params.range[0]}
            onChange={v => update({ range: [v, params.range[1]] })}
          />
          <NumericInput
            className="jp-mod-styled"
            placeholder="max"
            value={params.range[1]}
            onChange={v => update({ range: [params.range[0], v] })}
          />
        </div>
      </div>
      <div className="jp-gis-symbology-row">
        <label>Fallback</label>
        <NumericInput
          className="jp-mod-styled"
          value={params.fallback}
          onChange={v => update({ fallback: v })}
        />
      </div>
      <button className="jp-gis-grammar-action-btn" onClick={classify}>
        Set stops
      </button>
      {stopRows.length > 0 && (
        <StopContainer
          selectedMethod="radius"
          stopRows={stopRows}
          setStopRows={handleStopRowsChange}
        />
      )}
    </div>
  );
};
