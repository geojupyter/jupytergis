import { FieldProps } from '@rjsf/utils';
import React from 'react';

/**
 * Renders a marker so CSS can collapse the row (RJSF doesn't apply uiSchema classNames to the wrapper).
 * Use via uiSchema: { myKey: { 'ui:field': 'hidden' } }.
 */
function HiddenField(_props: FieldProps): React.ReactElement {
  return <div className="jGIS-hidden-field" aria-hidden="true" />;
}

export default HiddenField;
