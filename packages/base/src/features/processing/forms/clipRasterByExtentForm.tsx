import { IDict, IJupyterGISModel } from '@jupytergis/schema';
import { Dialog } from '@jupyterlab/apputils';
import { Signal } from '@lumino/signaling';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { SchemaForm } from '@/src/formbuilder/objectform/SchemaForm';
import { useSchemaFormState } from '@/src/formbuilder/objectform/useSchemaFormState';
import type { IBaseFormProps } from '@/src/types';
import { MapExtentToggle } from './MapExtentToggle';
import { useMapExtent } from './useMapExtent';

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
  const { isActive: mapExtentActive, extentRef, toggle } = useMapExtent(model);

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
            required: mapExtentActive
              ? ([] as string[])
              : ['xMin', 'yMin', 'xMax', 'yMax'],
            additionalProperties: false,
          }
        : null,
    [schema, mapExtentActive],
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
        ...(mapExtentActive ? extentRef.current : {}),
      }));
    },
    [setFormData, mapExtentActive, extentRef],
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

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const extent = toggle(e.target.checked);
      if (extent) {
        setFormData(prev => ({ ...prev, ...extent }));
      }
    },
    [toggle, setFormData],
  );

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

      {/* Map extent toggle + extent fields */}
      <MapExtentToggle
        isActive={mapExtentActive}
        onChange={handleCheckboxChange}
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
      </MapExtentToggle>

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
