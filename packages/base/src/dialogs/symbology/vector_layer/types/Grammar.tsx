import React, { useEffect, useState } from 'react';

import { colorToRgba, RgbaColor } from '@/src/dialogs/symbology/colorRampUtils';
import RgbaColorPicker from '@/src/dialogs/symbology/components/color_ramp/RgbaColorPicker';
import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import MappingTable from '@/src/dialogs/symbology/grammar/components/MappingTable';
import { anyStateToGrammarRules } from '@/src/dialogs/symbology/grammar/grammarConversions';
import { grammarToOLStyle } from '@/src/dialogs/symbology/grammar/grammarToOLStyle';
import {
  IEncodingRule,
  IGrammarSymbologyState,
  OLStyleChannel,
} from '@/src/dialogs/symbology/grammar/types';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  getEffectiveSymbologyParams,
  saveSymbology,
} from '@/src/dialogs/symbology/symbologyUtils';

// ---------------------------------------------------------------------------
// FallbackEditor — per-channel default values used as the case-chain else branch
// ---------------------------------------------------------------------------

const FALLBACK_COLOR_CHANNELS: OLStyleChannel[] = [
  'fill-color',
  'stroke-color',
  'circle-fill-color',
  'circle-stroke-color',
];

const FALLBACK_NUMERIC_CHANNELS: OLStyleChannel[] = [
  'stroke-width',
  'circle-radius',
  'circle-stroke-width',
];

const FALLBACK_LABELS: Partial<Record<OLStyleChannel, string>> = {
  'fill-color': 'Fill',
  'stroke-color': 'Stroke',
  'circle-fill-color': 'Marker Fill',
  'circle-stroke-color': 'Marker Stroke',
  'stroke-width': 'Stroke Width',
  'circle-radius': 'Marker Size',
  'circle-stroke-width': 'Marker Stroke Width',
};

interface IFallbackEditorProps {
  fallback: Partial<Record<OLStyleChannel, any>>;
  onChange: (fallback: Partial<Record<OLStyleChannel, any>>) => void;
}

const FallbackEditor: React.FC<IFallbackEditorProps> = ({ fallback, onChange }) => {
  const [open, setOpen] = useState(false);

  const setChannel = (ch: OLStyleChannel, value: any) => {
    onChange({ ...fallback, [ch]: value });
  };

  return (
    <div className="jp-gis-grammar-fallback">
      <button
        className="jp-gis-grammar-fallback-toggle"
        onClick={() => setOpen(v => !v)}
      >
        {open ? '▾' : '▸'} Fallback Style
      </button>
      {open && (
        <div className="jp-gis-grammar-fallback-body">
          <p className="jp-gis-mapping-empty">
            Applied to features not matched by any conditional rule.
          </p>
          {FALLBACK_COLOR_CHANNELS.map(ch => {
            const raw = fallback[ch] ?? 'rgba(0,0,0,0)';
            const color: RgbaColor = colorToRgba(raw);
            return (
              <div key={ch} className="jp-gis-color-row">
                <span className="jp-mod-styled jp-gis-color-row-value-input" style={{ display: 'flex', alignItems: 'center' }}>
                  {FALLBACK_LABELS[ch]}
                </span>
                <RgbaColorPicker
                  color={color}
                  onChange={c => setChannel(ch, `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`)}
                />
              </div>
            );
          })}
          {FALLBACK_NUMERIC_CHANNELS.map(ch => {
            const val = typeof fallback[ch] === 'number' ? fallback[ch] : 0;
            return (
              <div key={ch} className="jp-gis-symbology-row">
                <label>{FALLBACK_LABELS[ch]}:</label>
                <input
                  type="number"
                  className="jp-mod-styled"
                  min={0}
                  value={val}
                  onChange={e => setChannel(ch, parseFloat(e.target.value) || 0)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Grammar component
// ---------------------------------------------------------------------------

const Grammar: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [rules, setRules] = useState<IEncodingRule[]>([]);
  const [fallback, setFallback] = useState<Partial<Record<OLStyleChannel, any>>>({});
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const { featureProperties, isLoading } = useGetProperties({
    layerId,
    model,
  });

  useEffect(() => {
    if (!layerId) {
      return;
    }
    const layer = model.getLayer(layerId);
    const params = getEffectiveSymbologyParams(
      model,
      layerId,
      layer,
      isStorySegmentOverride,
      segmentId,
    );
    const state = params?.symbologyState as IGrammarSymbologyState | undefined;

    if (state?.renderType === 'Grammar' && state.rules) {
      // Already Grammar — restore persisted state.
      setRules(state.rules);
      setFallback(state.fallback ?? {});
    } else {
      // Convert from another render type (pre-fill).
      const converted = anyStateToGrammarRules(
        params?.symbologyState,
        (params?.color ?? {}) as Record<string, any>,
      );
      if (converted && converted.length > 0) {
        setRules(converted);
      }
    }
  }, [layerId]);

  const handleOk = () => {
    if (!layerId) {
      return;
    }
    const state: IGrammarSymbologyState = {
      renderType: 'Grammar',
      rules,
      fallback: Object.keys(fallback).length > 0 ? fallback : undefined,
    };
    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState: state as any,
        color: grammarToOLStyle(state),
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  if (!layerId) {
    return null;
  }

  if (isLoading) {
    return <p>Loading layer properties…</p>;
  }

  return (
    <div className="jp-gis-grammar-container">
      <MappingTable
        rules={rules}
        featureProperties={featureProperties}
        selectedRuleId={selectedRuleId}
        onSelectRule={setSelectedRuleId}
        onRulesChange={setRules}
      />
      <FallbackEditor fallback={fallback} onChange={setFallback} />
    </div>
  );
};

export default Grammar;
