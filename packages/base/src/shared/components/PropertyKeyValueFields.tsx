import React from 'react';

import { Input } from './Input';

export interface IPropertyKeyValueFieldsProps {
  propertyKey: string;
  propertyValue: string;
  onPropertyKeyChange: (value: string) => void;
  onPropertyValueChange: (value: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  disabled?: boolean;
}

export function PropertyKeyValueFields({
  propertyKey,
  propertyValue,
  onPropertyKeyChange,
  onPropertyValueChange,
  keyPlaceholder = 'key',
  valuePlaceholder = 'value',
  onKeyDown,
  disabled = false,
}: IPropertyKeyValueFieldsProps): JSX.Element {
  return (
    <>
      <Input
        className="jgis-attribute-col-key"
        type="text"
        placeholder={keyPlaceholder}
        value={propertyKey}
        onChange={event => onPropertyKeyChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <Input
        className="jgis-attribute-col-value"
        type="text"
        placeholder={valuePlaceholder}
        value={propertyValue}
        onChange={event => onPropertyValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
    </>
  );
}
