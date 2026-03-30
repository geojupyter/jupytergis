import React, { useEffect, useState } from 'react';

import { useGetProperties } from '@/src/dialogs/symbology/hooks/useGetProperties';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import MappingTable from '@/src/dialogs/symbology/grammar/components/MappingTable';
import { grammarToOLStyle } from '@/src/dialogs/symbology/grammar/grammarToOLStyle';
import {
  IEncodingRule,
  IGrammarSymbologyState,
} from '@/src/dialogs/symbology/grammar/types';
import { ISymbologyDialogProps } from '@/src/dialogs/symbology/symbologyDialog';
import {
  getEffectiveSymbologyParams,
  saveSymbology,
} from '@/src/dialogs/symbology/symbologyUtils';

const Grammar: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  const [rules, setRules] = useState<IEncodingRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const { featureProperties, isLoading } = useGetProperties({
    layerId,
    model,
  });

  // Restore existing grammar state, respecting story segment overrides.
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
      setRules(state.rules);
    }
  }, [layerId]);

  const handleOk = () => {
    if (!layerId) {
      return;
    }
    const state: IGrammarSymbologyState = { renderType: 'Grammar', rules };
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
    </div>
  );
};

export default Grammar;
