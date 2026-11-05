import {
  IAnnotationModel,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import * as React from 'react';

import { AnnotationsPanel } from '../../features/annotations';
import { pencilSolidIcon } from '../../shared/icons';
import { FloatingPanelId } from './floatingPanelDock';
import { FloatingRightPanel } from './floatingRightPanel';

interface IAnnotationsRightPanelProps {
  model: IJupyterGISModel;
  annotationModel: IAnnotationModel;
  settings: IJupyterGISSettings;
}

const AnnotationsRightPanelComponent: React.FC<IAnnotationsRightPanelProps> = ({
  model,
  annotationModel,
  settings,
}) => {
  const [hasAnnotations, setHasAnnotations] = React.useState(
    () => annotationModel.getAnnotationIds().length > 0,
  );

  React.useEffect(() => {
    const refresh = () => {
      setHasAnnotations(annotationModel.getAnnotationIds().length > 0);
    };

    model.sharedAnnotationsChanged.connect(refresh);
    refresh();

    return () => {
      model.sharedAnnotationsChanged.disconnect(refresh);
    };
  }, [model, annotationModel]);

  const visible =
    !settings.rightPanelDisabled &&
    !settings.annotationsDisabled &&
    hasAnnotations;

  if (!visible) {
    return null;
  }

  return (
    <FloatingRightPanel
      value={FloatingPanelId.Annotations}
      title="Annotations"
      icon={pencilSolidIcon}
    >
      <AnnotationsPanel annotationModel={annotationModel} jgisModel={model} />
    </FloatingRightPanel>
  );
};

AnnotationsRightPanelComponent.displayName = 'AnnotationsRightPanel';

export const AnnotationsRightPanel = React.memo(AnnotationsRightPanelComponent);
