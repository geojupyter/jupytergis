import React from 'react';

interface IProps {
  formData?: any[];
  name: string;
  required: boolean;
  schema: any;
  errorSchema?: { [key: string]: any };
  onChange: (updatedValue: any[]) => void;
  onBlur: (name: string, value: any) => void;
}

const CustomArrayField: React.FC<IProps> = props => {
  const {
    formData = [],
    name,
    required,
    schema,
    errorSchema = {},
    onChange,
    onBlur
  } = props;

  const handleInputChange = (index: number, value: any) => {
    const updatedValue = [...formData];
    updatedValue[index] = value;
    onChange(updatedValue);
  };

  const renderInputField = (value: any, index: number) => {
    const { enum: enumOptions, type: itemType } = schema.items || {};
    if (enumOptions) {
      return (
        <select
          value={value || ''}
          required={required}
          onChange={e => handleInputChange(index, e.target.value)}
          onBlur={() => onBlur(name, value)}
        >
          {enumOptions.map((option: string, i: number) => (
            <option key={i} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    } else if (itemType === 'number') {
      return (
        <input
          type="number"
          value={value}
          step="any"
          required={required}
          onChange={e =>
            handleInputChange(
              index,
              e.target.value === '' ? null : parseFloat(e.target.value)
            )
          }
          onBlur={() => onBlur(name, value)}
        />
      );
    } else if (itemType === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => handleInputChange(index, e.target.checked)}
          onBlur={() => onBlur(name, value)}
        />
      );
    } else {
      return (
        <input
          type="text"
          value={value}
          required={required}
          onChange={e => handleInputChange(index, e.target.value)}
          onBlur={() => onBlur(name, value)}
        />
      );
    }
  };

  return (
    <fieldset>
      <legend>{name}</legend>
      <p className="field-description">{schema.description}</p>
      <div className="custom-array-wrapper">
        {formData.map((value: any, index: number) => (
          <div key={index} className="array-item">
            {renderInputField(value, index)}

            {errorSchema?.[index]?.__errors?.length > 0 && (
              <div className="validationErrors">
                {errorSchema?.[index]?.__errors.map(
                  (error: string, errorIndex: number) => (
                    <div key={`${index}-${errorIndex}`} className="error">
                      {error}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
};

export default CustomArrayField;
