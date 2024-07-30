import { IJupyterGISClientState, IJupyterGISModel } from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import { LabIcon, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { MouseEvent, useEffect, useState } from 'react';
import { icons } from '../../constants';
import { IControlPanelModel } from '../../types';
import { ILeftPanelClickHandlerParams, ILeftPanelOptions } from '../leftpanel';

const SOURCES_PANEL_CLASS = 'jp-gis-sourcePanel';
const SOURCE_CLASS = 'jp-gis-source';
const SOURCE_TITLE_CLASS = 'jp-gis-sourceTitle';
const SOURCE_ICON_CLASS = 'jp-gis-sourceIcon';
const SOURCE_TEXT_CLASS = 'jp-gis-sourceText';
const SOURCE_UNUSED = 'jp-gis-sourceUnused';
const SOURCE_INFO = 'jp-gis-sourceInfo';

/**
 * The sources panel widget.
 */
export class SourcesPanel extends Panel {
  constructor(options: ILeftPanelOptions) {
    super();
    this._model = options.model;
    this._onSelect = options.onSelect;

    this.id = 'jupytergis::sourcesPanel';
    this.addClass(SOURCES_PANEL_CLASS);

    this.addWidget(
      ReactWidget.create(
        <SourcesBodyComponent
          model={this._model}
          onSelect={this._onSelect}
        ></SourcesBodyComponent>
      )
    );
  }

  private _model: IControlPanelModel | undefined;
  private _onSelect: ({
    type,
    item,
    nodeId
  }: ILeftPanelClickHandlerParams) => void;
}

/**
 * Properties of the sources body component.
 */
interface IBodyProps {
  model: IControlPanelModel;
  onSelect: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

/**
 * The body component of the panel.
 */
function SourcesBodyComponent(props: IBodyProps): JSX.Element {
  const [model, setModel] = useState<IJupyterGISModel | undefined>(
    props.model?.jGISModel
  );
  const [sourceIds, setSourceIds] = useState<string[]>(
    Private.sortedSourceIds(model)
  );

  /**
   * Propagate the source selection.
   */
  const onItemClick = ({
    type,
    item,
    nodeId,
    event
  }: ILeftPanelClickHandlerParams) => {
    props.onSelect({ type, item, nodeId, event });
  };

  /**
   * Listen to the sources and changes.
   */
  useEffect(() => {
    const updateSources = () => {
      setSourceIds([...Private.sortedSourceIds(model)]);
    };
    model?.sharedModel.sourcesChanged.connect(updateSources);
    model?.clientStateChanged.connect(updateSources);

    updateSources();
    return () => {
      model?.sharedModel.sourcesChanged.disconnect(updateSources);
      model?.clientStateChanged.disconnect(updateSources);
    };
  }, [model]);

  /**
   * Update the model when it changes.
   */
  props.model?.documentChanged.connect((_, widget) => {
    setModel(widget?.context.model);
  });

  return (
    <div id="jp-gis-sources">
      {sourceIds.map(sourceId => {
        return (
          <SourceComponent
            key={`source-${sourceId}`}
            gisModel={model}
            sourceId={sourceId}
            onClick={onItemClick}
          />
        );
      })}
    </div>
  );
}

/**
 * Properties of the source component.
 */
interface ISourceProps {
  gisModel: IJupyterGISModel | undefined;
  sourceId: string;
  onClick: ({ type, item, nodeId }: ILeftPanelClickHandlerParams) => void;
}

function isSelected(sourceId: string, model: IJupyterGISModel | undefined) {
  return (
    (model?.localState?.selected?.value &&
      Object.keys(model?.localState?.selected?.value).includes(sourceId)) ||
    false
  );
}

/**
 * The component to display a single source.
 */
function SourceComponent(props: ISourceProps): JSX.Element {
  const { sourceId, gisModel, onClick } = props;
  const source = gisModel?.getSource(sourceId);
  if (source === undefined) {
    return <></>;
  }

  const [id, setId] = useState('');
  const [selected, setSelected] = useState<boolean>(
    // TODO Support multi-selection as `model?.jGISModel?.localState?.selected.value` does
    isSelected(sourceId, gisModel)
  );
  const [unused, setUnused] = useState<boolean>(false);
  const name = source.name;

  useEffect(() => {
    setId(DOMUtils.createDomID());
  }, []);

  /**
   * Check if the source is used by a layer.
   */
  useEffect(() => {
    const checkUsage = () => {
      setUnused(!gisModel?.getLayersBySource(sourceId).length ?? true);
    };

    gisModel?.sharedLayersChanged.connect(checkUsage);
    checkUsage();

    return () => {
      gisModel?.sharedLayersChanged.disconnect(checkUsage);
    };
  }, [gisModel]);

  /**
   * Listen to the changes on the current source.
   */
  useEffect(() => {
    const onClientSharedStateChanged = (
      sender: IJupyterGISModel,
      clients: Map<number, IJupyterGISClientState>
    ) => {
      // TODO Support follow mode and remoteUser state
      setSelected(isSelected(sourceId, gisModel));
    };
    gisModel?.clientStateChanged.connect(onClientSharedStateChanged);

    return () => {
      gisModel?.clientStateChanged.disconnect(onClientSharedStateChanged);
    };
  }, [gisModel]);

  const setSelection = (event: MouseEvent<HTMLElement>) => {
    const childId = event.currentTarget.children.namedItem(id)?.id;
    onClick({ type: 'source', item: sourceId, nodeId: childId, event });
  };

  let mainClasses = SOURCE_CLASS;
  if (selected) {
    mainClasses = mainClasses.concat(' jp-mod-selected');
  }
  if (unused) {
    mainClasses = mainClasses.concat(` ${SOURCE_UNUSED}`);
  }
  return (
    <div className={mainClasses}>
      <div
        className={SOURCE_TITLE_CLASS}
        onClick={setSelection}
        onContextMenu={setSelection}
      >
        {icons.has(source.type) && (
          <LabIcon.resolveReact
            {...icons.get(source.type)}
            className={SOURCE_ICON_CLASS}
          />
        )}
        <span id={id} className={SOURCE_TEXT_CLASS}>
          {name}
        </span>
        {unused && <span className={SOURCE_INFO}>(unused)</span>}
      </div>
    </div>
  );
}

namespace Private {
  export function sortedSourceIds(
    model: IJupyterGISModel | undefined
  ): string[] {
    const sources = model?.getSources();
    if (sources === undefined) {
      return [];
    }
    return Object.keys(sources).sort((id1: string, id2: string): number => {
      const name1 = sources[id1].name.toLowerCase();
      const name2 = sources[id2].name.toLowerCase();
      return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
    });
  }
}
