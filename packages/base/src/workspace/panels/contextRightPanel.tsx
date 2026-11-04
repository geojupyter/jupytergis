import {
  IAnnotationModel,
  IDict,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import React, { FC, useState, useEffect, memo } from 'react';

import { AnnotationsPanel } from '../../features/annotations';
import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';
import { FloatingRightPanel } from './floatingRightPanel';

type ContextMode = 'identify' | 'annotations';

interface IContextRightPanelProps {
  model: IJupyterGISModel;
  settings: IJupyterGISSettings;
  annotationModel?: IAnnotationModel;
  patchGeoJSONFeatureAttributes?: (
    sourceId: string,
    target: { featureId: string },
    attributeUpdates: IDict<any>,
  ) => Promise<boolean>;
}

function getContextMode(
  model: IJupyterGISModel,
  settings: IJupyterGISSettings,
  annotationModel: IAnnotationModel | undefined,
): ContextMode | null {
  if (settings.rightPanelDisabled) {
    return null;
  }

  const isIdentifying = model.currentMode === 'identifying';
  if (isIdentifying && !settings.identifyDisabled) {
    return 'identify';
  }

  if (
    !isIdentifying &&
    !settings.annotationsDisabled &&
    annotationModel &&
    annotationModel.getAnnotationIds().length > 0
  ) {
    return 'annotations';
  }

  return null;
}

const ContextRightPanelComponent: FC<IContextRightPanelProps> = ({
  model,
  settings,
  annotationModel,
  patchGeoJSONFeatureAttributes,
}) => {
  const [mode, setMode] = useState<ContextMode | null>(() =>
    getContextMode(model, settings, annotationModel),
  );

  useEffect(() => {
    const refresh = () => {
      setMode(getContextMode(model, settings, annotationModel));
    };

    model.modeChanged.connect(refresh);
    model.sharedAnnotationsChanged.connect(refresh);
    refresh();

    return () => {
      model.modeChanged.disconnect(refresh);
      model.sharedAnnotationsChanged.disconnect(refresh);
    };
  }, [model, settings, annotationModel]);

  if (!mode) {
    return null;
  }

  if (mode === 'identify') {
    return (
      <FloatingRightPanel title="Identified Features">
        <IdentifyPanelComponent
          model={model}
          patchGeoJSONFeatureAttributes={patchGeoJSONFeatureAttributes}
        />
      </FloatingRightPanel>
    );
  }

  if (!annotationModel) {
    return null;
  }

  return (
    <FloatingRightPanel title="Annotations">
      <AnnotationsPanel annotationModel={annotationModel} jgisModel={model} />
    </FloatingRightPanel>
  );
};

ContextRightPanelComponent.displayName = 'ContextRightPanel';

export const ContextRightPanel = memo(ContextRightPanelComponent);
