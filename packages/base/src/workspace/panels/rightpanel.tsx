import {
  IAnnotationModel,
  IDict,
  IJGISFormSchemaRegistry,
  IJupyterGISModel,
  IJupyterGISSettings,
} from '@jupytergis/schema';
import { CommandRegistry } from '@lumino/commands';
import * as React from 'react';
import Draggable from 'react-draggable';

import { useRightPanelOptions } from './hooks/useRightPanelOptions';
import { useUIState } from './hooks/useUIState';
import { AnnotationsPanel } from '../../features/annotations';
import { IdentifyPanelComponent } from '../../features/identify/IdentifyPanel';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../shared/components/Tabs';

interface IRightPanelProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
  commands: CommandRegistry;
  settings: IJupyterGISSettings;
  patchGeoJSONFeatureAttributes?: (
    sourceId: string,
    target: { featureId: string },
    attributeUpdates: IDict<any>,
  ) => Promise<boolean>;
}

const RightPanelComponent: React.FC<IRightPanelProps> = props => {
  const { patchGeoJSONFeatureAttributes } = props;

  const [curTab, setCurTab] = React.useState<string>(() => {
    if (!props.settings.annotationsDisabled) {
      return 'annotations';
    }
    if (!props.settings.identifyDisabled) {
      return 'identifyPanel';
    }
    return '';
  });

  useRightPanelOptions(props.model, {
    onIdentifyFeatures: () => setCurTab('identifyPanel'),
  });

  const tabInfo = [
    !props.settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !props.settings.identifyDisabled
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const allRightTabsDisabled =
    props.settings.annotationsDisabled && props.settings.identifyDisabled;

  const [rightPanelOpen] = useUIState('rightPanelOpen', props.model);

  const rightPanelVisible =
    !props.settings.rightPanelDisabled &&
    !allRightTabsDisabled &&
    rightPanelOpen !== false;

  return (
    <Draggable
      handle="[data-slot='tabs-list']"
      cancel="[data-slot='tabs-trigger']"
      bounds=".jGIS-Mainview-Container"
    >
      <div
        className="jgis-right-panel-container"
        style={{ display: rightPanelVisible ? 'block' : 'none' }}
      >
        <Tabs className="jgis-panel-tabs" value={curTab || null}>
          <TabsList>
            {tabInfo.map(tab => (
              <TabsTrigger
                key={`${tab.name}-${tab.title}`}
                value={tab.name}
                onClick={() => {
                  if (curTab !== tab.name) {
                    setCurTab(tab.name);
                  } else {
                    setCurTab('');
                  }
                }}
              >
                {tab.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {!props.settings.annotationsDisabled && (
            <TabsContent value="annotations" className="jgis-panel-tab-content">
              <AnnotationsPanel
                annotationModel={props.annotationModel}
                jgisModel={props.model}
              ></AnnotationsPanel>
            </TabsContent>
          )}

          {!props.settings.identifyDisabled && (
            <TabsContent
              value="identifyPanel"
              className="jgis-panel-tab-content"
            >
              <IdentifyPanelComponent
                model={props.model}
                patchGeoJSONFeatureAttributes={patchGeoJSONFeatureAttributes}
              ></IdentifyPanelComponent>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </Draggable>
  );
};

RightPanelComponent.displayName = 'RightPanel';

export const RightPanel = React.memo(RightPanelComponent);
