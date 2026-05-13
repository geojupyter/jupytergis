import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import { transformExtent } from 'ol/proj';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import type { IBaseFormProps } from '@/src/types';

export interface IClipRasterByExtentFormProps extends IBaseFormProps {
  ok?: Signal<Dialog<any>, number>;
  model: IJupyterGISModel;
}

export function ClipRasterByExtentForm(
  props: IClipRasterByExtentFormProps,
): React.ReactElement | null {
  const {
    schema: schemaProp,
    sourceData,
    syncData,
    model,
    filePath,
    ok,
  } = props;

  const { formData, setFormData, schema, hasSchema } = useSchemaFormState({
    sourceData,
    schemaProp,
    model,
  });

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [useMapExtent, setUseMapExtent] = useState(false);
  const extentRef = useRef<IDict>({});

  useEffect(() => {
    if (!ok) {
      return;
    }
    const handler = () => submitButtonRef.current?.click();
    ok.connect(handler);
    return () => {
      ok.disconnect(handler);
    };
  }, [ok]);

  const formContextValue = useMemo(
    () => ({ model, formData }),
    [model, formData],
  );

  // Schema for the top section: inputLayer only
  const schemaTop = useMemo(
    () =>
      schema?.properties?.inputLayer
        ? {
            type: 'object',
            properties: { inputLayer: schema.properties.inputLayer },
            required: [] as string[],
            additionalProperties: false,
          }
        : null,
    [schema],
  );

  // Schema for the extent section: xMin/yMin/xMax/yMax
  // Required only when the user is entering them manually
  const schemaExtent = useMemo(
    () =>
      schema?.properties
        ? {
            type: 'object',
            properties: {
              xMin: schema.properties.xMin,
              yMin: schema.properties.yMin,
              xMax: schema.properties.xMax,
              yMax: schema.properties.yMax,
            },
            required: useMapExtent
              ? ([] as string[])
              : ['xMin', 'yMin', 'xMax', 'yMax'],
            additionalProperties: false,
          }
        : null,
    [schema, useMapExtent],
  );

  // Schema for the bottom section: output options
  const schemaBottom = useMemo(
    () =>
      schema?.properties
        ? {
            type: 'object',
            properties: {
              outputFileName: schema.properties.outputFileName,
              embedOutputLayer: schema.properties.embedOutputLayer,
            },
            required: [] as string[],
            additionalProperties: false,
          }
        : null,
    [schema],
  );

  const handleTopChange = useCallback(
    (data: IDict) => setFormData(prev => ({ ...prev, ...data })),
    [setFormData],
  );

  const handleExtentChange = useCallback(
    (data: IDict) => {
      // When using map extent, rjsf may strip disabled-looking fields on some
      // browsers; always restore the cached extent values to be safe.
      setFormData(prev => ({
        ...prev,
        ...data,
        ...(useMapExtent ? extentRef.current : {}),
      }));
    },
    [setFormData, useMapExtent],
  );

  const handleBottomChange = useCallback(
    (data: IDict) => setFormData(prev => ({ ...prev, ...data })),
    [setFormData],
  );

  const handleSubmit = useCallback(
    (data: IDict) => {
      syncData?.({ ...formData, ...data });
    },
    [syncData, formData],
  );

  const getAndStoreMapExtent = (): IDict | null => {
    const viewport =
      model.sharedModel.awareness.getLocalState()?.viewportState?.value;
    if (!viewport?.extent) {
      return null;
    }
    const mapProjection =
      (model.sharedModel.options as any)?.projection ?? 'EPSG:3857';
    let [xMin, yMin, xMax, yMax] = viewport.extent;
    if (mapProjection !== 'EPSG:4326') {
      [xMin, yMin, xMax, yMax] = transformExtent(
        viewport.extent,
        mapProjection,
        'EPSG:4326',
      );
    }
    const round = (v: number) => Math.round(v * 1e6) / 1e6;
    const extent = {
      xMin: round(xMin),
      yMin: round(yMin),
      xMax: round(xMax),
      yMax: round(yMax),
    };
    extentRef.current = extent;
    return extent;
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      const extent = getAndStoreMapExtent();
      if (extent) {
        setUseMapExtent(true);
        setFormData(prev => ({ ...prev, ...extent }));
      }
      // If viewport isn't ready, leave the checkbox unchecked and fields required
    } else {
      setUseMapExtent(false);
      extentRef.current = {};
    }
  };

  if (!hasSchema || !schemaTop || !schemaExtent || !schemaBottom) {
    return null;
  }

  return (
    <div>
      {/* Layer selector */}
      <SchemaForm
        schema={schemaTop}
        formData={{ inputLayer: formData.inputLayer }}
        onChange={handleTopChange}
        onSubmit={() => undefined}
        formContext={formContextValue}
        filePath={filePath}
        liveValidate={false}
      />

      {/* Map extent toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          margin: '4px 0 8px',
          cursor: 'pointer',
          fontSize: 'var(--jp-ui-font-size1)',
        }}
      >
        <input
          type="checkbox"
          checked={useMapExtent}
          onChange={handleCheckboxChange}
        />
        Use current map extent
      </label>

      {/* Extent fields — CSS-disabled when checkbox is on */}
      <div
        style={
          useMapExtent ? { pointerEvents: 'none', opacity: 0.4 } : undefined
        }
      >
        <SchemaForm
          schema={schemaExtent}
          formData={{
            xMin: formData.xMin,
            yMin: formData.yMin,
            xMax: formData.xMax,
            yMax: formData.yMax,
          }}
          onChange={handleExtentChange}
          onSubmit={() => undefined}
          formContext={formContextValue}
          filePath={filePath}
        />
      </div>

      {/* Output options — has the hidden submit button wired to the OK signal */}
      <SchemaForm
        schema={schemaBottom}
        formData={{
          outputFileName: formData.outputFileName,
          embedOutputLayer: formData.embedOutputLayer,
        }}
        onChange={handleBottomChange}
        onSubmit={handleSubmit}
        formContext={formContextValue}
        filePath={filePath}
        submitButtonRef={submitButtonRef}
        liveValidate={false}
      />
    </div>
  );
}
