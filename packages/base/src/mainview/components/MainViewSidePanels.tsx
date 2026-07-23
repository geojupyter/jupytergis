import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import type { PatchGeoJSONFeatureAttributes } from '@/src/mainview/geoJsonFeaturePatch';
import { LeftPanel, MergedPanel, RightPanel } from '@/src/workspace/panels';

export interface IMainViewSidePanelsProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
  showMergedMobilePanel: boolean;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  patchGeoJSONFeatureAttributes: PatchGeoJSONFeatureAttributes;
}

export function MainViewSidePanels({
  model,
  commands,
  settings,
  showMergedMobilePanel,
  state,
  formSchemaRegistry,
  annotationModel,
  patchGeoJSONFeatureAttributes,
}: IMainViewSidePanelsProps): JSX.Element {
  if (showMergedMobilePanel) {
    return (
      <MergedPanel
        model={model}
        commands={commands}
        state={state!}
        settings={settings}
        formSchemaRegistry={formSchemaRegistry!}
        annotationModel={annotationModel!}
      />
    );
  }

  return (
    <>
      {state ? (
        <LeftPanel
          model={model}
          commands={commands}
          state={state}
          settings={settings}
        />
      ) : null}
      {formSchemaRegistry && annotationModel ? (
        <RightPanel
          model={model}
          commands={commands}
          formSchemaRegistry={formSchemaRegistry}
          annotationModel={annotationModel}
          settings={settings}
          patchGeoJSONFeatureAttributes={patchGeoJSONFeatureAttributes}
        />
      ) : null}
    </>
  );
}
