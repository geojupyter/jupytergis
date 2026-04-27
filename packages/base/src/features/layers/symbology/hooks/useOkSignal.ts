import { Signal } from '@lumino/signaling';
import { useCallback, useEffect, useRef } from 'react';

type OkSignalPromise = {
  promise: Promise<Signal<any, null>>;
};

export function useOkSignal(
  okSignalPromise: OkSignalPromise,
  handleOk: () => void,
): void {
  const handleOkRef = useRef(handleOk);

  useEffect(() => {
    handleOkRef.current = handleOk;
  }, [handleOk]);

  const slot = useCallback(() => {
    handleOkRef.current();
  }, []);

  useEffect(() => {
    let disposed = false;

    okSignalPromise.promise.then(okSignal => {
      if (disposed) {
        return;
      }
      okSignal.connect(slot);
    });

    return () => {
      disposed = true;
      okSignalPromise.promise.then(okSignal => {
        okSignal.disconnect(slot);
      });
    };
  }, [okSignalPromise, slot]);
}
