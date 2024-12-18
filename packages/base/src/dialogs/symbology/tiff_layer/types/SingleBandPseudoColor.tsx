import { IDict, IWebGlLayer } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { GeoTiffClassifications } from '../../classificationModes';
import { GlobalStateDbManager } from '../../../../store';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import BandRow from '../components/BandRow';
import ColorRamp, {
  ColorRampOptions
} from '../../components/color_ramp/ColorRamp';
import StopRow from '../../components/color_stops/StopRow';
import { Utils } from '../../symbologyUtils';
import { getGdal } from '../../../../gdal';
import { Spinner } from '../../../../mainview/spinner';
import { saveToIndexedDB, getFromIndexedDB } from '../../utils/indexedDBUtil';

export interface IBandRow {
  band: number;
  colorInterpretation: string;
  stats: {
    minimum: number;
    maximum: number;
    mean: number;
    stdDev: number;
  };
  metadata: IDict;
  histogram: IBandHistogram;
}

export interface IBandHistogram {
  buckets: number[];
  count: number;
  max: number;
  min: number;
}

export type InterpolationType = 'discrete' | 'linear' | 'exact';

type TifBandData = {
  band: number;
  colorInterpretation: string;
  minimum: number;
  maximum: number;
  mean: number;
  stdDev: number;
  metadata: any;
  histogram: IBandHistogram;
};

const SingleBandPseudoColor = ({
  context,
  okSignalPromise,
  cancel,
  layerId
}: ISymbologyDialogProps) => {
  const functions = ['discrete', 'linear', 'exact'];
  const modeOptions = ['continuous', 'equal interval', 'quantile'];
  const stopRowsRef = useRef<IStopRow[]>();
  const bandRowsRef = useRef<IBandRow[]>([]);
  const selectedFunctionRef = useRef<InterpolationType>();
  const colorRampOptionsRef = useRef<ColorRampOptions | undefined>();
  const layerStateRef = useRef<ReadonlyJSONObject | undefined>();
  const selectedBandRef = useRef<number>();

  const [layerState, setLayerState] = useState<ReadonlyJSONObject>();
  const [selectedBand, setSelectedBand] = useState(1);
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [selectedFunction, setSelectedFunction] =
    useState<InterpolationType>('linear');
  const [colorRampOptions, setColorRampOptions] = useState<
    ColorRampOptions | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer?.parameters) {
    return;
  }
  const stateDb = GlobalStateDbManager.getInstance().getStateDb();

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
    layerStateRef.current = layerState;
    getBandInfo();
  }, [layerState]);

  useEffect(() => {
    bandRowsRef.current = bandRows;
    buildColorInfo();
  }, [bandRows]);

  useEffect(() => {
    stopRowsRef.current = stopRows;
    selectedFunctionRef.current = selectedFunction;
    colorRampOptionsRef.current = colorRampOptions;
    selectedBandRef.current = selectedBand;
    layerStateRef.current = layerState;
  }, [stopRows, selectedFunction, colorRampOptions, selectedBand, layerState]);

  const populateOptions = async () => {
    const layerState = (await stateDb?.fetch(
      `jupytergis:${layerId}`
    )) as ReadonlyJSONObject;

    setLayerState(layerState);

    const layerParams = layer.parameters as IWebGlLayer;
    const band = layerParams.symbologyState?.band ?? 1;
    const interpolation = layerParams.symbologyState?.interpolation ?? 'linear';

    setSelectedBand(band);
    setSelectedFunction(interpolation);
  };

  const preloadGeoTiffFile = async (sourceInfo: { url: string | null }) => {
    if (!sourceInfo?.url) {
      return;
    }

    const cachedData = await getFromIndexedDB(sourceInfo.url);
    if (cachedData) {
      const file = cachedData.file;
      const metadata = cachedData.metadata;
      const sourceUrl = sourceInfo.url;
      return { file, metadata, sourceUrl };
    }

    // Download the file and save it to indexedDB
    const fileData = await fetch(sourceInfo.url);
    const fileBlob = await fileData.blob();
    const file = new File([fileBlob], 'loaded.tif');

    const Gdal = await getGdal();
    const result = await Gdal.open(file);
    const tifDataset = result.datasets[0];
    const tifData = await Gdal.gdalinfo(tifDataset, ['-stats']);
    Gdal.close(tifDataset);

    await saveToIndexedDB(sourceInfo.url, fileBlob, tifData);

    return { file, metadata: tifData, sourceUrl: sourceInfo.url };
  };

  const getBandInfo = async () => {
    const bandsArr: IBandRow[] = [];
    const source = context.model.getSource(layer?.parameters?.source);
    const sourceInfo = source?.parameters?.urls[0];

    if (!sourceInfo?.url) {
      return;
    }

    // Preload the file only once
    const preloadedFile = await preloadGeoTiffFile(sourceInfo);
    const { file, metadata, sourceUrl } = { ...preloadedFile };

    if (file && metadata && sourceUrl === sourceInfo.url) {
      metadata['bands'].forEach((bandData: TifBandData) => {
        bandsArr.push({
          band: bandData.band,
          colorInterpretation: bandData.colorInterpretation,
          stats: {
            minimum: sourceInfo.min ?? bandData.minimum,
            maximum: sourceInfo.max ?? bandData.maximum,
            mean: bandData.mean,
            stdDev: bandData.stdDev
          },
          metadata: bandData.metadata,
          histogram: bandData.histogram
        });
      });
      setBandRows(bandsArr);
    }
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
            output: color[i + 1]
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
            output: color[i + 1]
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
    const source = context.model.getSource(sourceId);

    if (!source || !source.parameters) {
      return;
    }

    const isQuantile = colorRampOptionsRef.current?.selectedMode === 'quantile';

    const sourceInfo = source.parameters.urls[0];
    sourceInfo.min = bandRow.stats.minimum;
    sourceInfo.max = bandRow.stats.maximum;

    source.parameters.urls[0] = sourceInfo;

    context.model.sharedModel.updateSource(sourceId, source);

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
            unscaleValue(stop.stop, isQuantile)
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
            unscaleValue(stop.stop, isQuantile)
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
      mode: colorRampOptionsRef.current?.selectedMode
    };

    layer.parameters.symbologyState = symbologyState;
    layer.parameters.color = colorExpr;

    context.model.sharedModel.updateLayer(layerId, layer);
    cancel();
  };

  const addStopRow = () => {
    setStopRows([
      {
        stop: 0,
        output: [0, 0, 0, 1]
      },
      ...stopRows
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
    setIsLoading: (isLoading: boolean) => void
  ) => {
    // Update layer state with selected options
    setColorRampOptions({
      selectedRamp,
      numberOfShades,
      selectedMode
    });

    let stops: number[] = [];

    const currentBand = bandRows[selectedBand - 1];
    const source = context.model.getSource(layer?.parameters?.source);
    const sourceInfo = source?.parameters?.urls[0];
    const nClasses = selectedMode === 'continuous' ? 52 : +numberOfShades;

    setIsLoading(true);
    switch (selectedMode) {
      case 'quantile':
        stops = await GeoTiffClassifications.classifyQuantileBreaks(
          nClasses,
          selectedBand,
          sourceInfo.url,
          selectedFunction
        );
        break;
      case 'continuous':
        stops = GeoTiffClassifications.classifyContinuousBreaks(
          nClasses,
          currentBand.stats.minimum,
          currentBand.stats.maximum,
          selectedFunction
        );
        break;
      case 'equal interval':
        stops = GeoTiffClassifications.classifyEqualIntervalBreaks(
          nClasses,
          currentBand.stats.minimum,
          currentBand.stats.maximum,
          selectedFunction
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
      nClasses
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
        {bandRows.length === 0 ? (
          <Spinner loading={bandRows.length === 0} />
        ) : (
          <BandRow
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
