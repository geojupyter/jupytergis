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
 * Keeps symbology updated when the layer changes.
 */
export const useGetSymbology = ({
  layerId,
  model,
}: IUseGetSymbologyProps): IUseGetSymbologyResult => {
  const [symbology, setSymbology] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!layerId) {
      return;
    }

    let disposed = false;

    const fetchSymbology = () => {
      try {
        setIsLoading(true);
        setError(undefined);

        const layer = model.getLayer(layerId);

        if (!layer) {
          throw new Error(`Layer not found: ${layerId}`);
        }

        const params = layer.parameters ?? {};
        const { symbologyState, color, ...rest } = params;

        const result: Record<string, any> = {
          ...rest,
          ...(color ? { color } : {}),
          ...(symbologyState ? { symbologyState } : {}),
        };

        if (!disposed) {
          setSymbology(result);
        }
      } catch (err) {
        if (!disposed) {
          setError(err as Error);
          setSymbology(null);
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    };

    // initial load
    fetchSymbology();

    model.sharedLayersChanged.connect(() => {
      if (model.getLayer(layerId)) {
        fetchSymbology();
      } else {
        if (!disposed) {
          setSymbology(null);
          setIsLoading(false);
        }
      }
    });

    model.sharedModel.awareness.on('change', () => {
      console.log(`Awareness changed for layer ${layerId}`);
      fetchSymbology();
    });

    return () => {
      disposed = true;
    };
  }, [layerId, model]);

  return { symbology, isLoading, error };
};
