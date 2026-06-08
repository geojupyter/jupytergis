import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJGISLayer,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import React from 'react';

import type { PatchGeoJSONFeatureProperties } from '@/src/mainview/geoJsonFeaturePatch';
import { LeftPanel, MergedPanel, RightPanel } from '@/src/workspace/panels';

export interface IMainViewSidePanelsProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
  showMergedMobilePanel: boolean;
  state?: IStateDB;
  formSchemaRegistry?: IJGISFormSchemaRegistry;
  annotationModel?: IAnnotationModel;
  addLayer: (id: string, layer: IJGISLayer, index: number) => Promise<void>;
  removeLayer: (id: string) => void;
  patchGeoJSONFeatureProperties: PatchGeoJSONFeatureProperties;
  notebookTracker?: { currentWidget: { content: any } | null };
}

export function MainViewSidePanels({
  model,
  commands,
  settings,
  showMergedMobilePanel,
  state,
  formSchemaRegistry,
  annotationModel,
  addLayer,
  removeLayer,
  patchGeoJSONFeatureProperties,
  notebookTracker,
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
        addLayer={addLayer}
        removeLayer={removeLayer}
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
          addLayer={addLayer}
          removeLayer={removeLayer}
          settings={settings}
          patchGeoJSONFeatureProperties={patchGeoJSONFeatureProperties}
          notebookTracker={notebookTracker}
        />
      ) : null}
    </>
  );
}
