import React from 'react';

import { Input } from './Input';

export interface IPropertyKeyValueFieldsProps {
  propertyKey: string;
  propertyValue: string;
  onPropertyKeyChange: (value: string) => void;
  onPropertyValueChange: (value: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onEnter?: () => void;
}

export function PropertyKeyValueFields({
  propertyKey,
  propertyValue,
  onPropertyKeyChange,
  onPropertyValueChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  onEnter,
}: IPropertyKeyValueFieldsProps): JSX.Element {
  return (
    <>
      <Input
        className="jgis-property-col-key"
        type="text"
        placeholder={keyPlaceholder}
        value={propertyKey}
        onChange={event => onPropertyKeyChange(event.target.value)}
        onEnter={onEnter ? () => onEnter() : undefined}
      />
      <Input
        className="jgis-property-col-value"
        type="text"
        placeholder={valuePlaceholder}
        value={propertyValue}
        onChange={event => onPropertyValueChange(event.target.value)}
        onEnter={onEnter ? () => onEnter() : undefined}
      />
    </>
  );
}
