import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISClientState,
  IJupyterGISModel,
} from '@jupytergis/schema';
import * as React from 'react';

import { AnnotationsPanel } from './annotationPanel';
import { IdentifyPanelComponent } from './components/identify-panel/IdentifyPanel';
import { ObjectPropertiesReact } from './objectproperties';
import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../shared/components/Tabs';

interface IRightPanelProps {
  formSchemaRegistry: IJGISFormSchemaRegistry;
  annotationModel: IAnnotationModel;
  model: IJupyterGISModel;
}

export const RightPanel: React.FC<IRightPanelProps> = props => {
  const [settings, setSettings] = React.useState(props.model.jgisSettings);
  const tabInfo = [
    !settings.objectPropertiesDisabled
      ? { name: 'objectProperties', title: 'Object Properties' }
      : false,
    !settings.annotationsDisabled
      ? { name: 'annotations', title: 'Annotations' }
      : false,
    !settings.identifyDisabled
      ? { name: 'identifyPanel', title: 'Identified Features' }
      : false,
  ].filter(Boolean) as { name: string; title: string }[];

  const [curTab, setCurTab] = React.useState<string | undefined>(
    tabInfo.length > 0 ? tabInfo[0].name : undefined,
  );

  React.useEffect(() => {
    const onSettingsChanged = () => {
      setSettings({ ...props.model.jgisSettings });
    };
    let currentlyIdentifiedFeatures: any = undefined;
    const onAwerenessChanged = (
      _: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>,
    ) => {
      const clientId = props.model.getClientId();
      const localState = clientId ? clients.get(clientId) : null;

      if (
        localState &&
        localState.identifiedFeatures?.value &&
        localState.identifiedFeatures.value !== currentlyIdentifiedFeatures
      ) {
        currentlyIdentifiedFeatures = localState.identifiedFeatures.value;
        setCurTab('identifyPanel');
      }
    };

    props.model.settingsChanged.connect(onSettingsChanged);
    props.model.clientStateChanged.connect(onAwerenessChanged);

    return () => {
      props.model.settingsChanged.disconnect(onSettingsChanged);
      props.model.clientStateChanged.disconnect(onAwerenessChanged);
    };
  }, [props.model]);

  const allRightTabsDisabled =
    settings.objectPropertiesDisabled &&
    settings.annotationsDisabled &&
    settings.identifyDisabled;

  const rightPanelVisible =
    !settings.rightPanelDisabled && !allRightTabsDisabled;

  const [selectedObjectProperties, setSelectedObjectProperties] =
    React.useState(undefined);

  return (
    <div
      className="jgis-right-panel-container"
      style={{ display: rightPanelVisible ? 'block' : 'none' }}
    >
      <PanelTabs className="jgis-panel-tabs" curTab={curTab}>
        <TabsList>
          {tabInfo.map(e => (
            <TabsTrigger
              className="jGIS-layer-browser-category"
              value={e.name}
              onClick={() => {
                if (curTab !== e.name) {
                  setCurTab(e.name);
                } else {
                  setCurTab('');
                }
              }}
            >
              {e.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {!settings.objectPropertiesDisabled && (
          <TabsContent
            value="objectProperties"
            className="jgis-panel-tab-content"
          >
            <ObjectPropertiesReact
              setSelectedObject={setSelectedObjectProperties}
              selectedObject={selectedObjectProperties}
              formSchemaRegistry={props.formSchemaRegistry}
              model={props.model}
            />
          </TabsContent>
        )}

        {!settings.annotationsDisabled && (
          <TabsContent value="annotations" className="jgis-panel-tab-content">
            <AnnotationsPanel
              annotationModel={props.annotationModel}
              jgisModel={props.model}
            ></AnnotationsPanel>
          </TabsContent>
        )}

        {!settings.identifyDisabled && (
          <TabsContent value="identifyPanel" className="jgis-panel-tab-content">
            <IdentifyPanelComponent
              model={props.model}
            ></IdentifyPanelComponent>
          </TabsContent>
        )}
      </PanelTabs>
    </div>
  );
};
