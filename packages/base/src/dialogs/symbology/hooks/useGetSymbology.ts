import { IJupyterGISModel } from '@jupytergis/schema';
import { useEffect, useState } from 'react';

interface IUseGetSymbologyProps {
  layerId?: string;
  model: IJupyterGISModel;
}

interface IUseGetSymbologyResult {
  symbology: Record<string, any> | null;
  isLoading: boolean;
  error?: Error;
}

/**
 * Extracts symbology information (paint/layout + symbologyState)
 * for a given layer from the JupyterGIS model.
 */
export const useGetSymbology = ({
  layerId,
  model,
}: IUseGetSymbologyProps): IUseGetSymbologyResult => {
  const [symbology, setSymbology] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!layerId) {return;}

    try {
      setIsLoading(true);
      setError(undefined);

      const layer = model.getLayer(layerId);

      if (!layer) {
        throw new Error(`Layer not found: ${layerId}`);
      }

      const params = layer.parameters ?? {};
      const { symbologyState, color, ...rest } = params;

      // Merge both style props + high-level symbology metadata
      const result: Record<string, any> = {
        ...rest,
        ...(color ? { color } : {}),
        ...(symbologyState ? { symbologyState } : {}),
      };

      setSymbology(result);
    } catch (err) {
      setError(err as Error);
      setSymbology(null);
    } finally {
      setIsLoading(false);
    }
  }, [layerId, model]);

  return { symbology, isLoading, error };
};
