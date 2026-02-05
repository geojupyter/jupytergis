import { Button } from '@jupyterlab/ui-components';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import { GeoTiffClassifications } from '@/src/dialogs/symbology/classificationModes';
import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/dialogs/symbology/components/color_ramp/ColorRampControls';
import StopRow from '@/src/dialogs/symbology/components/color_stops/StopRow';
import useGetBandInfo from '@/src/dialogs/symbology/hooks/useGetBandInfo';
import { useOkSignal } from '@/src/dialogs/symbology/hooks/useOkSignal';
import {
  IStopRow,
  ISymbologyDialogProps,
} from '@/src/dialogs/symbology/symbologyDialog';
import {
  saveSymbology,
  Utils,
  WebGlSymbologyParams,
} from '@/src/dialogs/symbology/symbologyUtils';
import BandRow from '@/src/dialogs/symbology/tiff_layer/components/BandRow';
import { LoadingOverlay } from '@/src/shared/components/loading';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { GlobalStateDbManager } from '@/src/store';
import { ClassificationMode } from '@/src/types';
import { ColorRampName } from '../../colorRampUtils';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';
import { IWebGlLayer } from '@jupytergis/schema';

export type InterpolationType = 'discrete' | 'linear' | 'exact';

const SingleBandPseudoColor: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  resolveDialog,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);

  const params = useEffectiveSymbologyParams<WebGlSymbologyParams>({
    model,
    layerId: layerId,
    layer,
    isStorySegmentOverride,
    segmentId,
  });

  if (!params || !layer) {
    return;
  }

  const functions = ['discrete', 'linear', 'exact'];
  const modeOptions = [
    'continuous',
    'equal interval',
    'quantile',
  ] as const satisfies ClassificationMode[];

  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  const { bandRows, setBandRows, loading } = useGetBandInfo(model, layer);

  const [layerState, setLayerState] = useState<ReadonlyJSONObject>();
  const [selectedBand, setSelectedBand] = useState(1);
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [selectedFunction, setSelectedFunction] =
    useState<InterpolationType>('linear');
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampControlsOptions | undefined
  >();

  const stopRowsRef = useLatest(stopRows);
  const bandRowsRef = useLatest(bandRows);
  const selectedFunctionRef = useLatest(selectedFunction);
  const colorRampOptionsRef = useLatest(colorRampOptions);
  const selectedBandRef = useLatest(selectedBand);

  useEffect(() => {
    populateOptions();
  }, []);

  useEffect(() => {
    buildColorInfo();
  }, [bandRows]);

  const populateOptions = async () => {
    const layerState = (await stateDb?.fetch(
      `jupytergis:${layerId}`,
    )) as ReadonlyJSONObject;

    setLayerState(layerState);

    const band = params.symbologyState?.band ?? 1;
    const interpolation = params.symbologyState?.interpolation ?? 'linear';

    setSelectedBand(band);
    setSelectedFunction(interpolation);
  };

  const buildColorInfo = () => {
    // This it to parse a color object on the layer
    if (!params.color || !layerState) {
      return;
    }

    const color = params.color;

    // If color is a string we don't need to parse
    // Otherwise color expression should be an array (e.g. ['interpolate', ...] or ['case', ...])
    if (!Array.isArray(color)) {
      return;
    }

    // ! wtf ? dont use statedb just read from the file??
    const isQuantile = (layerState.selectedMode as string) === 'quantile';

    const valueColorPairs: IStopRow[] = [];

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
            stop: scaleValue(Number(color[i]), isQuantile),
            output: color[i + 1] as IStopRow['output'],
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
          const stopVal = Number(
            Array.isArray(color[i])
              ? (color[i] as (string | number)[])[2]
              : color[i],
          );
          const obj: IStopRow = {
            stop: scaleValue(stopVal, isQuantile),
            output: color[i + 1] as IStopRow['output'],
          };
          valueColorPairs.push(obj);
        }
        break;
      }
    }

    setStopRows(valueColorPairs);
  };

  const handleOk = () => {
    const bandRow = bandRowsRef.current[selectedBand - 1];
    if (!bandRow) {
      return;
    }

    const isQuantile = colorRampOptionsRef.current?.selectedMode === 'quantile';

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
      nClasses:
        colorRampOptionsRef.current?.numberOfShades != null
          ? String(colorRampOptionsRef.current.numberOfShades)
          : undefined,
      mode: colorRampOptionsRef.current?.selectedMode,
    } as IWebGlLayer['symbologyState'];

    if (!isStorySegmentOverride) {
      // Update source
      const sourceId = layer?.parameters?.source;
      const source = model.getSource(sourceId);
      if (!source || !source.parameters) {
        return;
      }

      const sourceInfo = source.parameters.urls[0];
      sourceInfo.min = bandRow.stats.minimum;
      sourceInfo.max = bandRow.stats.maximum;

      source.parameters.urls[0] = sourceInfo;
      model.sharedModel.updateSource(sourceId, source);
    }

    saveSymbology({
      model,
      layerId,
      isStorySegmentOverride,
      segmentId,
      payload: {
        symbologyState,
        color: colorExpr,
      },
      mutateLayerBeforeSave: targetLayer => {
        targetLayer.type = 'WebGlLayer';
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

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
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
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
    const nClasses = selectedMode === 'continuous' ? 52 : numberOfShades;

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
        <LoadingOverlay loading={loading} />
        <BandRow
          label="Band"
          // Band numbers are 1 indexed
          index={selectedBand - 1}
          bandRow={bandRows[selectedBand - 1]}
          bandRows={bandRows}
          setSelectedBand={setSelectedBand}
          setBandRows={setBandRows}
        />
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
        <ColorRampControls
          layerParams={params}
          modeOptions={modeOptions}
          classifyFunc={buildColorInfoFromClassification}
          showModeRow={true}
          showRampSelector={true}
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
            dataValue={stop.stop}
            symbologyValue={stop.output}
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
