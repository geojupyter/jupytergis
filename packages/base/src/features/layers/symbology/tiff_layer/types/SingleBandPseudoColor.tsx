import { IGeoTiffLayer } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { UUID } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useState } from 'react';

import { GeoTiffClassifications } from '@/src/features/layers/symbology/classificationModes';
import ColorRampControls, {
  ColorRampControlsOptions,
} from '@/src/features/layers/symbology/components/color_ramp/ColorRampControls';
import StopRow from '@/src/features/layers/symbology/components/color_stops/StopRow';
import useGetBandInfo from '@/src/features/layers/symbology/hooks/useGetBandInfo';
import { useOkSignal } from '@/src/features/layers/symbology/hooks/useOkSignal';
import {
  IStopRow,
  ISymbologyDialogProps,
} from '@/src/features/layers/symbology/symbologyDialog';
import {
  saveSymbology,
  Utils,
  GeoTiffSymbologyParams,
} from '@/src/features/layers/symbology/symbologyUtils';
import BandRow from '@/src/features/layers/symbology/tiff_layer/components/BandRow';
import { LoadingOverlay } from '@/src/shared/components/loading';
import { useLatest } from '@/src/shared/hooks/useLatest';
import { ClassificationMode } from '@/src/types';
import { ColorRampName, getColorMap } from '../../colorRampUtils';
import { useEffectiveSymbologyParams } from '../../hooks/useEffectiveSymbologyParams';

export type InterpolationType = 'discrete' | 'linear' | 'exact';

const SingleBandPseudoColor: React.FC<ISymbologyDialogProps> = ({
  model,
  okSignalPromise,
  layerId,
  isStorySegmentOverride,
  segmentId,
}) => {
  if (!layerId) {
    return;
  }
  const layer = model.getLayer(layerId);

  const params = useEffectiveSymbologyParams<GeoTiffSymbologyParams>({
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

  const { bandRows, setBandRows, loading } = useGetBandInfo(model, layer);

  const [selectedBand, setSelectedBand] = useState(1);
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [selectedFunction, setSelectedFunction] =
    useState<InterpolationType>('linear');
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampControlsOptions | undefined
  >();
  const [stopsAltered, setStopsAltered] = useState(false);

  const stopRowsRef = useLatest(stopRows);
  const bandRowsRef = useLatest(bandRows);
  const selectedFunctionRef = useLatest(selectedFunction);
  const colorRampOptionsRef = useLatest(colorRampOptions);
  const selectedBandRef = useLatest(selectedBand);
  const stopsAlteredRef = useLatest(stopsAltered);

  useEffect(() => {
    populateOptions();
  }, []);

  useEffect(() => {
    if (bandRows.length === 0) {
      return;
    }

    if (stopsAlteredRef.current) {
      return;
    }

    if (!params.symbologyState) {
      return;
    }

    const { mode, nClasses, colorRamp, reverseRamp } =
      getClassificationParams();
    buildColorInfoFromClassification(
      mode,
      nClasses,
      colorRamp,
      reverseRamp,
      () => undefined,
    );
  }, [bandRows, selectedBand]);

  const populateOptions = () => {
    const state = params.symbologyState;
    const { mode, nClasses, colorRamp, reverseRamp } =
      getClassificationParams();

    setSelectedBand(state?.band ?? 1);
    setSelectedFunction(state?.interpolation ?? 'linear');
    setColorRampOptions({
      selectedRamp: colorRamp,
      numberOfShades: nClasses,
      selectedMode: mode,
      reverseRamp,
    });

    if (state?.stopsOverride?.length) {
      setStopRows(state.stopsOverride as IStopRow[]);
      setStopsAltered(true);
    }
  };

  const getClassificationParams = () => {
    const state = params.symbologyState;
    return {
      mode: (state?.mode ?? 'equal interval') as ClassificationMode,
      nClasses: Number(state?.nClasses ?? 9),
      colorRamp: (state?.colorRamp ?? 'viridis') as ColorRampName,
      reverseRamp: state?.reverseRamp ?? false,
    };
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
        colorRampOptionsRef.current?.numberOfShades !== undefined
          ? String(colorRampOptionsRef.current.numberOfShades)
          : undefined,
      mode: colorRampOptionsRef.current?.selectedMode,
      reverseRamp: colorRampOptionsRef.current?.reverseRamp,
      ...(stopsAlteredRef.current && stopRowsRef.current.length > 0
        ? { stopsOverride: stopRowsRef.current }
        : {}),
    } as IGeoTiffLayer['symbologyState'];

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
        targetLayer.type = 'GeoTiffLayer';
      },
    });
  };

  useOkSignal(okSignalPromise, handleOk);

  const addStopRow = () => {
    setStopsAltered(true);
    setStopRows(rows => [
      {
        id: UUID.uuid4(),
        stop: 0,
        output: [0, 0, 0, 1],
      },
      ...rows,
    ]);
  };

  const deleteStopRow = (index: number) => {
    setStopsAltered(true);
    const newFilters = [...stopRows];
    newFilters.splice(index, 1);

    setStopRows(newFilters);
  };

  const updateStopRows: React.Dispatch<
    React.SetStateAction<IStopRow[]>
  > = rows => {
    setStopsAltered(true);
    setStopRows(rows);
  };
  const buildColorInfoFromClassification = async (
    selectedMode: ClassificationMode,
    numberOfShades: number,
    selectedRamp: ColorRampName,
    reverseRamp: boolean,
    setIsLoading: (isLoading: boolean) => void,
  ) => {
    // Update layer state with selected options
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode,
      reverseRamp,
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

    const colorRamp = getColorMap(selectedRamp);
    if (!colorRamp) {
      return;
    }

    const valueColorPairs = Utils.getValueColorPairs(
      stops,
      colorRamp,
      nClasses,
      reverseRamp,
    );

    setStopRows(valueColorPairs);
    setStopsAltered(false);
  };

  const unscaleValue = (value: number | string, isQuantile: boolean) => {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`unscaleValue expects a number, got: ${value}`);
    }

    const currentBand = bandRowsRef.current[selectedBand - 1];

    const min = isQuantile ? 1 : currentBand.stats.minimum;
    const max = isQuantile ? 65535 : currentBand.stats.maximum;

    if (max === min) {
      return 0;
    }
    return (num - min) / (max - min);
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
            {functions.map(func => (
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
            key={stop.id}
            index={index}
            dataValue={stop.stop}
            symbologyValue={stop.output}
            stopRows={stopRows}
            setStopRows={updateStopRows}
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
