import { IWebGlLayer } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';

import { GeoTiffClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRamp, {
  ColorRampOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRamp';
import StopRow from '@/src/dialogs/symbology/components/color_stops/StopRow';
import useGetBandInfo, {
  IBandRow,
} from '@/src/dialogs/symbology/hooks/useGetBandInfo';
import {
  IStopRow,
  ISymbologyDialogProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import { Utils } from '@/src/dialogs/symbology/symbologyUtils';
import BandRow from '@/src/dialogs/symbology/tiff_layer/components/BandRow';
import { Spinner } from '@/src/mainview/spinner';
import { GlobalStateDbManager } from '@/src/store';

export type InterpolationType = 'discrete' | 'linear' | 'exact';

const SingleBandPseudoColor = ({
  model,
  okSignalPromise,
  cancel,
  layerId,
}: ISymbologyDialogProps) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }

  const functions = ['discrete', 'linear', 'exact'];
  const modeOptions = ['continuous', 'equal interval', 'quantile'];

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  const { bandRows, setBandRows, loading } = useGetBandInfo(model, layer);

  const [layerState, setLayerState] = useState<ReadonlyJSONObject>();
  const [selectedBand, setSelectedBand] = useState(1);
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [selectedFunction, setSelectedFunction] =
    useState<InterpolationType>('linear');
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();

  const stopRowsRef = useRef<IStopRow[]>();
  const bandRowsRef = useRef<IBandRow[]>([]);
  const selectedFunctionRef = useRef<InterpolationType>();
  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();
  const selectedBandRef = useRef<number>();

  useEffect(() => {
    populateOptions();

    okSignalPromise.promise.then(okSignal => {
      okSignal.connect(handleOk);
    });

    return () => {
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(handleOk, this);
      });
    };
  }, []);

  useEffect(() => {
    bandRowsRef.current = bandRows;
    buildColorInfo();
  }, [bandRows]);

  useEffect(() => {
    stopRowsRef.current = stopRows;
    selectedFunctionRef.current = selectedFunction;
    colorRampOptionsRef.current = colorRampOptions;
    selectedBandRef.current = selectedBand;
  }, [stopRows, selectedFunction, colorRampOptions, selectedBand, layerState]);

  const populateOptions = async () => {
    const layerState = (await stateDb?.fetch(
      `jupytergis:${layerId}`,
    )) as ReadonlyJSONObject;

    setLayerState(layerState);

    const layerParams = layer.parameters as IWebGlLayer;
    const band = layerParams.symbologyState?.band ?? 1;
    const interpolation = layerParams.symbologyState?.interpolation ?? 'linear';

    setSelectedBand(band);
    setSelectedFunction(interpolation);
  };

  const buildColorInfo = () => {
    // This it to parse a color object on the layer
    if (!layer.parameters?.color || !layerState) {
      return;
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return;
    }

    const isQuantile = (layerState.selectedMode as string) === 'quantile';

    const valueColorPairs: IStopRow[] = [];

    // So if it's not a string then it's an array and we parse
    // Color[0] is the operator used for the color expression
    switch (color[0]) {
      case 'interpolate': {
        // First element is interpolate for linear selection
        // Second element is type of interpolation (ie linear)
        // Third is input value that stop values are compared with
        // Fourth and Fifth are the transparent value for NoData values
        // Sixth and on is value:color pairs
        for (let i = 5; i < color.length; i += 2) {
          const obj: IStopRow = {
            stop: scaleValue(color[i], isQuantile),
            output: color[i + 1],
          };
          valueColorPairs.push(obj);
        }
        break;
      }
      case 'case': {
        // First element is case for discrete and exact selections
        // Second element is the condition for NoData values
        // Third element is transparent
        // Fourth is the condition for actual values
        // Within that, first is logical operator, second is band, third is value
        // Fifth is color
        // Last element is fallback value
        for (let i = 3; i < color.length - 1; i += 2) {
          const obj: IStopRow = {
            stop: scaleValue(color[i][2], isQuantile),
            output: color[i + 1],
          };
          valueColorPairs.push(obj);
        }
        break;
      }
    }

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    // Update source
    const bandRow = bandRowsRef.current[selectedBand - 1];
    if (!bandRow) {
      return;
    }
    const sourceId = layer.parameters?.source;
    const source = model.getSource(sourceId);

    if (!source || !source.parameters) {
      return;
    }

    const isQuantile = colorRampOptionsRef.current?.selectedMode === 'quantile';

    const sourceInfo = source.parameters.urls[0];
    sourceInfo.min = bandRow.stats.minimum;
    sourceInfo.max = bandRow.stats.maximum;

    source.parameters.urls[0] = sourceInfo;

    model.sharedModel.updateSource(sourceId, source);

    // Update layer
    if (!layer.parameters) {
      return;
    }

    // TODO: Different viewers will have different types
    let colorExpr: ExpressionValue[] = [];

    switch (selectedFunctionRef.current) {
      case 'linear': {
        colorExpr = ['interpolate', ['linear']];

        colorExpr.push(['band', selectedBand]);

        // Set NoData values to transparent
        colorExpr.push(0.0, [0.0, 0.0, 0.0, 0.0]);

        stopRowsRef.current?.map(stop => {
          colorExpr.push(unscaleValue(stop.stop, isQuantile));
          colorExpr.push(stop.output);
        });

        break;
      }

      case 'discrete': {
        colorExpr = ['case'];

        // Set NoData values to transparent
        colorExpr.push(['==', ['band', selectedBand], 0]);
        colorExpr.push([0.0, 0.0, 0.0, 0.0]);

        stopRowsRef.current?.map(stop => {
          colorExpr.push([
            '<=',
            ['band', selectedBand],
            unscaleValue(stop.stop, isQuantile),
          ]);
          colorExpr.push(stop.output);
        });

        // fallback value
        colorExpr.push([0, 0, 0, 0.0]);
        break;
      }
      case 'exact': {
        colorExpr = ['case'];

        // Set NoData values to transparent
        colorExpr.push(['==', ['band', selectedBand], 0]);
        colorExpr.push([0.0, 0.0, 0.0, 0.0]);

        stopRowsRef.current?.map(stop => {
          colorExpr.push([
            '==',
            ['band', selectedBand],
            unscaleValue(stop.stop, isQuantile),
          ]);
          colorExpr.push(stop.output);
        });

        // fallback value
        colorExpr.push([0, 0, 0, 0.0]);
        break;
      }
    }

    const symbologyState = {
      renderType: 'Singleband Pseudocolor',
      band: selectedBandRef.current,
      interpolation: selectedFunctionRef.current,
      colorRamp: colorRampOptionsRef.current?.selectedRamp,
      nClasses: colorRampOptionsRef.current?.numberOfShades,
      mode: colorRampOptionsRef.current?.selectedMode,
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorExpr;
    layer.type = 'WebGlLayer';

    model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const addStopRow = () => {
    setStopRows([
      {
        stop: 0,
        output: [0, 0, 0, 1],
      },
      ...stopRows,
    ]);
  };

  const deleteStopRow = (index: number) => {
    const newFilters = [...stopRows];
    newFilters.splice(index, 1);

    setStopRows(newFilters);
  };

  const buildColorInfoFromClassification = async (
    selectedMode: string,
    numberOfShades: string,
    selectedRamp: string,
    setIsLoading: (isLoading: boolean) => void,
  ) => {
    // Update layer state with selected options
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode,
    });

    let stops: number[] = [];

    const currentBand = bandRows[selectedBand - 1];
    const source = model.getSource(layer?.parameters?.source);
    const sourceInfo = source?.parameters?.urls[0];
    const nClasses = selectedMode === 'continuous' ? 52 : +numberOfShades;

    setIsLoading(true);
    switch (selectedMode) {
      case 'quantile':
        stops = await GeoTiffClassifications.classifyQuantileBreaks(
          nClasses,
          selectedBand,
          sourceInfo.url,
          selectedFunction,
        );
        break;
      case 'continuous':
        stops = GeoTiffClassifications.classifyContinuousBreaks(
          nClasses,
          currentBand.stats.minimum,
          currentBand.stats.maximum,
          selectedFunction,
        );
        break;
      case 'equal interval':
        stops = GeoTiffClassifications.classifyEqualIntervalBreaks(
          nClasses,
          currentBand.stats.minimum,
          currentBand.stats.maximum,
          selectedFunction,
        );
        break;
      default:
        console.warn('No mode selected');
        return;
    }
    setIsLoading(false);

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      selectedRamp,
      nClasses,
    );

    setStopRows(valueColorPairs);
  };

  const scaleValue = (bandValue: number, isQuantile: boolean) => {
    const currentBand = bandRows[selectedBand - 1];

    if (!currentBand) {
      return bandValue;
    }

    const min = isQuantile ? 1 : currentBand.stats.minimum;
    const max = isQuantile ? 65535 : currentBand.stats.maximum;

    return (bandValue * (max - min)) / (1 - 0) + min;
  };

  const unscaleValue = (value: number, isQuantile: boolean) => {
    const currentBand = bandRowsRef.current[selectedBand - 1];

    const min = isQuantile ? 1 : currentBand.stats.minimum;
    const max = isQuantile ? 65535 : currentBand.stats.maximum;

    return (value * (1 - 0) - min * (1 - 0)) / (max - min);
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-band-container">
        {loading ? (
          <Spinner loading={loading} />
        ) : (
          <BandRow
            label="Band"
            // Band numbers are 1 indexed
            index={selectedBand - 1}
            bandRow={bandRows[selectedBand - 1]}
            bandRows={bandRows}
            setSelectedBand={setSelectedBand}
            setBandRows={setBandRows}
          />
        )}
      </div>
      <div className="jp-gis-symbology-row">
        <label htmlFor="function-select">Interpolation:</label>
        <div className="jp-select-wrapper">
          <select
            name="function-select"
            id="function-select"
            className="jp-mod-styled"
            value={selectedFunction}
            style={{ textTransform: 'capitalize' }}
            onChange={event => {
              setSelectedFunction(event.target.value as InterpolationType);
            }}
          >
            {functions.map((func, funcIndex) => (
              <option
                key={func}
                value={func}
                style={{ textTransform: 'capitalize' }}
              >
                {func}
              </option>
            ))}
          </select>
        </div>
      </div>
      {bandRows.length > 0 && (
        <ColorRamp
          layerParams={layer.parameters}
          modeOptions={modeOptions}
          classifyFunc={buildColorInfoFromClassification}
          showModeRow={true}
        />
      )}
      <div className="jp-gis-stop-container">
        <div className="jp-gis-stop-labels" style={{ display: 'flex', gap: 6 }}>
          <span style={{ flex: '0 0 18%' }}>
            Value{' '}
            {selectedFunction === 'discrete'
              ? '<='
              : selectedFunction === 'exact'
                ? '='
                : ''}
          </span>
          <span>Output Value</span>
        </div>
        {stopRows.map((stop, index) => (
          <StopRow
            key={`${index}-${stop.output}`}
            index={index}
            value={stop.stop}
            outputValue={stop.output}
            stopRows={stopRows}
            setStopRows={setStopRows}
            deleteRow={() => deleteStopRow(index)}
          />
        ))}
      </div>
      <div className="jp-gis-symbology-button-container">
        <Button
          className="jp-Dialog-button jp-mod-accept jp-mod-styled"
          onClick={addStopRow}
        >
          Add Stop
        </Button>
      </div>
    </div>
  );
};

export default SingleBandPseudoColor;
