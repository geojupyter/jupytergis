import {
  IJupyterGISClientState,
  IJupyterGISModel,
  ISelection,
  SelectionType
} from '@jupytergis/schema';
import { DOMUtils } from '@jupyterlab/apputils';
import { LabIcon, ReactWidget } from '@jupyterlab/ui-components';
import { Panel } from '@lumino/widgets';
import React, { MouseEvent, useEffect, useState } from 'react';
import { geoJSONIcon, rasterIcon } from '../../icons';
import { IControlPanelModel } from '../../types';

const SOURCES_PANEL_CLASS = 'jp-gis-sourcePanel';
const SOURCES_ITEM_CLASS = 'jp-gis-sourceItem';
const SOURCE_CLASS = 'jp-gis-source';
const SOURCE_TITLE_CLASS = 'jp-gis-sourceTitle';
const SOURCE_ICON_CLASS = 'jp-gis-sourceIcon';
const SOURCE_TEXT_CLASS = 'jp-gis-sourceText';

/**
 * The namespace for the sources panel.
 */
export namespace SourcesPanel {
  /**
   * Options of the sources panel widget.
   */
  export interface IOptions {
    model: IControlPanelModel;
  }

  export interface IClickHandlerParams {
    type: SelectionType;
    item: string;
    nodeId?: string;
    event: MouseEvent;
  }
}

/**
 * The sources panel widget.
 */
export class SourcesPanel extends Panel {
  constructor(options: SourcesPanel.IOptions) {
    super();
    this._model = options.model;
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

  /**
   * Function to call when a source is selected from a component of the panel.
   *
   * @param item - the selected source.
   */
  private _onSelect = ({
    type,
    item,
    nodeId,
    event
  }: SourcesPanel.IClickHandlerParams) => {
    if (!this._model) {
      return;
    }

    const { jGISModel } = this._model;
    const selectedValue = jGISModel?.localState?.selected?.value;

    // Early return if no selection exists
    if (!selectedValue) {
      this.resetSelected(type, nodeId, item);
      return;
    }

    // Don't want to reset selected if right clicking a selected item
    if (!event.ctrlKey && event.button === 2 && item in selectedValue) {
      return;
    }

    // Reset selection for normal left click
    if (!event.ctrlKey) {
      this.resetSelected(type, nodeId, item);
      return;
    }

    if (nodeId) {
      // Check if new selection is the same type as previous selections
      const isSelectedSameType = Object.values(selectedValue).some(
        selection => selection.type === type
      );

      if (!isSelectedSameType) {
        // Selecting a new type, so reset selected
        this.resetSelected(type, nodeId, item);
        return;
      }

      // If types are the same add the selection
      const updatedSelectedValue = {
        ...selectedValue,
        [item]: { type, selectedNodeId: nodeId }
      };

      jGISModel.syncSelected(updatedSelectedValue, this.id);
    }
  };

  resetSelected(type: SelectionType, nodeId?: string, item?: string) {
    const selection: { [key: string]: ISelection } = {};
    if (item && nodeId) {
      selection[item] = {
        type,
        selectedNodeId: nodeId
      };
    }
    this._model?.jGISModel?.syncSelected(selection, this.id);
  }

  private _model: IControlPanelModel | undefined;
}

/**
 * Properties of the sources body component.
 */
interface IBodyProps {
  model: IControlPanelModel;
  onSelect: ({ type, item, nodeId }: SourcesPanel.IClickHandlerParams) => void;
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
  }: SourcesPanel.IClickHandlerParams) => {
    props.onSelect({ type, item, nodeId, event });
  };

  /**
   * Listen to the sources and changes.
   */
  useEffect(() => {
    const updateSources = () => {
      setSourceIds(Private.sortedSourceIds(model));
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
  onClick: ({ type, item, nodeId }: SourcesPanel.IClickHandlerParams) => void;
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
  const name = source.name;

  useEffect(() => {
    setId(DOMUtils.createDomID());
  }, []);

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

  return (
    <div
      className={`${SOURCES_ITEM_CLASS} ${SOURCE_CLASS}${selected ? ' jp-mod-selected' : ''}`}
    >
      <div
        className={SOURCE_TITLE_CLASS}
        onClick={setSelection}
        onContextMenu={setSelection}
      >
        {source.type === 'RasterSource' && (
          <LabIcon.resolveReact
            icon={rasterIcon}
            className={SOURCE_ICON_CLASS}
          />
        )}
        {source.type === 'GeoJSONSource' && (
          <LabIcon.resolveReact
            icon={geoJSONIcon}
            className={SOURCE_ICON_CLASS}
          />
        )}
        {source.type === 'VectorTileSource' && (
          <LabIcon.resolveReact
            iconClass={'fa fa-vector-square'}
            className={SOURCE_ICON_CLASS}
          />
        )}
        <span id={id} className={SOURCE_TEXT_CLASS}>
          {name}
        </span>
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