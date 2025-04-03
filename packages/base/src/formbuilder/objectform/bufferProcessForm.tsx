import { BaseForm, IBaseFormProps, IBaseFormStates } from './baseform'; // Ensure BaseForm imports states
import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { IChangeEvent } from '@rjsf/core';
// import { loadFile } from '../../tools';
import proj4 from 'proj4';

interface IBufferFormOptions extends IBaseFormProps {
  schema: IDict;
  sourceData: IDict;
  title: string;
  cancelButton: (() => void) | boolean;
  syncData: (props: IDict) => void;
  model: IJupyterGISModel;
}

export class BufferForm extends BaseForm {
  private model: IJupyterGISModel;
  private unit = '';

  constructor(options: IBufferFormOptions) {
    super(options);
    this.model = options.model;

    // Ensure initial state matches IBaseFormStates
    this.state = {
      schema: options.schema ?? {} // Ensure schema is never undefined
    };

    this.onFormChange = this.handleFormChange.bind(this);

    this.computeDistanceUnits(options.sourceData.inputLayer);
  }

  private async computeDistanceUnits(layerId: string) {
    const layer = this.model.getLayer(layerId);
    if (!layer?.parameters?.source) {
      return;
    }
    const source = this.model.getSource(layer.parameters.source);
    if (!source) {
      return;
    }

    const projection = source.parameters?.projection;
    console.log(projection);

    // TODO: how to get layer info from OpenLayers?
    // const srs = layer.from_ol().srs;
    const srs = 'EPSG:4326';

    try {
      // console.log(proj4, srs);
      this.unit = (proj4(srs) as any).oProj.units;
      debugger;
      this.updateSchema();
    } catch (error) {
      console.error('Error calculating units:', error);
    }
  }

  public handleFormChange(e: IChangeEvent) {
    super.onFormChange(e);

    if (e.formData.inputLayer) {
      this.computeDistanceUnits(e.formData.inputLayer);
    }
  }

  private updateSchema() {
    this.setState(
      (prevState: IBaseFormStates) => ({
        schema: {
          ...prevState.schema,
          properties: {
            ...prevState.schema?.properties,
            bufferDistance: {
              ...prevState.schema?.properties?.bufferDistance,
              description:
                prevState.schema?.properties?.bufferDistance.description.replace(
                  'projection units',
                  this.unit
                )
            }
          }
        }
      }),
      () => {
        this.forceUpdate();
      }
    );
  }
}
