import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import { Button } from '@jupyterlab/ui-components';
import { ReadonlyJSONObject } from '@lumino/coreutils';
import colormap from 'colormap';
import { ExpressionValue } from 'ol/expr/expression';
import React, { useEffect, useRef, useState } from 'react';
import { GeoTiffClassifications } from '../../../classificationModes';
import { GlobalStateDbManager } from '../../../store';
import { IStopRow, ISymbologyDialogProps } from '../../symbologyDialog';
import BandRow from './BandRow';
import ColorRamp from './ColorRamp';
import StopRow from './StopRow';

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
  const colorRampOptionsRef = useRef<ReadonlyJSONObject | undefined>();

  const [selectedBand, setSelectedBand] = useState(1);
  const [stopRows, setStopRows] = useState<IStopRow[]>([]);
  const [bandRows, setBandRows] = useState<IBandRow[]>([]);
  const [selectedFunction, setSelectedFunction] =
    useState<InterpolationType>('linear');
  const [colorRampOptions, setColorRampOptions] = useState<
    ReadonlyJSONObject | undefined
  >();

  if (!layerId) {
    return;
  }
  const layer = context.model.getLayer(layerId);
  if (!layer) {
    return;
  }

  useEffect(() => {
    getBandInfo();
    setInitialFunction();

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
  }, [stopRows, selectedFunction, colorRampOptions]);

  const setInitialFunction = () => {
    if (!layer.parameters?.color) {
      setSelectedFunction('linear');
      return;
    }

    const color = layer.parameters.color;

    if (color[0] === 'interpolate') {
      setSelectedFunction('linear');
      return;
    }

    // If expression is using 'case' we look at the comparison operator to set selected function
    // Looking at fourth element because second is for nodata
    const operator = color[3][0];
    operator === '<='
      ? setSelectedFunction('discrete')
      : setSelectedFunction('exact');
  };

  const getBandInfo = async () => {
    const bandsArr: IBandRow[] = [];
    const source = context.model.getSource(layer?.parameters?.source);
    const sourceId = layer.parameters?.source;
    const sourceInfo = source?.parameters?.urls[0];

    if (!sourceInfo.url) {
      return;
    }

    let tifData;

    const stateDb = GlobalStateDbManager.getInstance().getStateDb();

    if (stateDb) {
      const layerState = (await stateDb.fetch(
        `jupytergis:${sourceId}`
      )) as ReadonlyJSONObject;

      console.log('layerState', layerState);
      if (layerState && layerState.tifData) {
        tifData = JSON.parse(layerState.tifData as string);
      }
      console.log('tifData', tifData);

      tifData['bands'].forEach((bandData: TifBandData) => {
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
    if (!layer.parameters?.color) {
      return;
    }

    const color = layer.parameters.color;

    // If color is a string we don't need to parse
    if (typeof color === 'string') {
      return;
    }
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
            stop: color[i],
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
            stop: color[i][2],
            output: color[i + 1]
          };
          valueColorPairs.push(obj);
        }
        break;
      }
    }

    setStopRows(valueColorPairs);
  };

  const handleOk = async () => {
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

    const stateDb = GlobalStateDbManager.getInstance().getStateDb();
    const layerState = (await stateDb?.fetch(
      `jupytergis:${layerId}`
    )) as ReadonlyJSONObject;

    stateDb?.save(`jupytergis:${layerId}`, {
      ...layerState,
      ...colorRampOptionsRef.current
    });

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
          colorExpr.push(stop.stop);
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
          colorExpr.push(['<=', ['band', selectedBand], stop.stop]);
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
          colorExpr.push(['==', ['band', selectedBand], stop.stop]);
          colorExpr.push(stop.output);
        });

        // fallback value
        colorExpr.push([0, 0, 0, 0.0]);
        break;
      }
    }
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
      selectedFunction,
      selectedRamp,
      numberOfShades,
      selectedMode
    });

    let stops: number[] = [];

    const currentBand = bandRows[selectedBand - 1];
    const source = context.model.getSource(layer?.parameters?.source);
    const sourceId = layer.parameters?.source;
    const sourceInfo = source?.parameters?.urls[0];
    const nClasses = selectedMode === 'continuous' ? 52 : +numberOfShades;
    const colorMap = colormap({
      colormap: selectedRamp,
      nshades: nClasses,
      format: 'rgba'
    });

    if (!sourceInfo.url) {
      return;
    }

    const valueColorPairs: IStopRow[] = [];

    setIsLoading(true);
    switch (selectedMode) {
      case 'quantile':
        stops = await GeoTiffClassifications.classifyQuantileBreaks(
          nClasses,
          selectedBand,
          sourceInfo.url,
          sourceId
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

    for (let i = 0; i < stops.length; i++) {
      valueColorPairs.push({ stop: stops[i], output: colorMap[i] });
    }

    setStopRows(valueColorPairs);
  };

  return (
    <div className="jp-gis-layer-symbology-container">
      <div className="jp-gis-band-container">
        {bandRows.length === 0 ? (
          <div className="jp-gis-band-info-loading-container">
            <span>Fetching band info...</span>
            <FontAwesomeIcon
              icon={faSpinner}
              className="jp-gis-loading-spinner"
            />
          </div>
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
          layerId={layerId}
          modeOptions={modeOptions}
          classifyFunc={buildColorInfoFromClassification}
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
