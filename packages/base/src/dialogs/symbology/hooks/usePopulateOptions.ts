import { ReadonlyJSONObject } from '@lumino/coreutils';
import { useState, useEffect } from 'react';
// import { GlobalStateDbManager } from '../../../../store';

interface IUsePopulateOptionsProps {
  layerId: string;
  layer?: any;
  featureProps: Record<string, Set<any>>;
  state: any;
}

interface IUsePopulateOptionsResult {
  methodOptions: string[];
  layerState: ReadonlyJSONObject | undefined;
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  selectedMethod: string;
  setSelectedMethod: (value: string) => void;
  isLoading: boolean;
  error?: Error;
}

export const usePopulateOptions = ({
  layerId,
  layer,
  featureProps,
  state
}: IUsePopulateOptionsProps): IUsePopulateOptionsResult => {
  const [layerState, setLayerState] = useState<ReadonlyJSONObject>();
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('color');
  const [methodOptions, setMethodOptions] = useState<string[]>(['color']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  // const stateDb = GlobalStateDbManager.getInstance().getStateDb();

  const populateOptions = async () => {
    let value: string | undefined;
    let method: string | undefined;

    try {
      // Set up method options
      if (layer?.parameters?.type === 'circle') {
        const options = ['color', 'radius'];
        setMethodOptions(options);
      }

      // const layerState = (await state.fetch(
      //   `jupytergis:${layerId}`
      // )) as ReadonlyJSONObject;

      if (layerState) {
        // const layerState = layerStateData as ReadonlyJSONObject;
        value = layerState.graduatedValue as string;
        method = layerState.graduatedMethod as string;
      }

      setLayerState(layerState);
      setSelectedValue(value ? value : Object.keys(featureProps)[0]);
      setSelectedMethod(method ? method : 'color');

      setIsLoading(false);
    } catch (err) {
      setError(err as Error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    populateOptions();
  }, [layerId, layer]);

  return {
    methodOptions,
    layerState,
    selectedValue,
    setSelectedValue,
    setSelectedMethod,
    selectedMethod,
    isLoading,
    error
  };
};
