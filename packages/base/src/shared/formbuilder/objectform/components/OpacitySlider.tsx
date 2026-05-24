import { Slider } from '@jupyter/react-components';
import { FieldProps } from '@rjsf/utils';
import React from 'react';

function OpacitySlider({ formData, onChange }: FieldProps<number>) {
  const [inputValue, setInputValue] = React.useState(
    formData?.toFixed(1) ?? '1',
  );

  React.useEffect(() => {
    const newValue = formData?.toFixed(1) ?? '1';
    if (newValue !== inputValue) {
      setInputValue(newValue);
    }
  }, [formData]);

  const handleSliderChange = (event: CustomEvent) => {
    const target = event.target as any;
    if (target && '_value' in target) {
      const sliderValue = parseFloat(target._value); // Slider value is in 0–10 range
      const normalizedValue = sliderValue / 10; // Normalize to 0.1–1 range
      onChange(normalizedValue);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);

    const parsedValue = parseFloat(value);
    if (!isNaN(parsedValue) && parsedValue >= 0.1 && parsedValue <= 1) {
      onChange(parsedValue);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Slider
        min={1}
        max={10}
        step={1}
        value={formData ? formData * 10 : 10}
        onChange={handleSliderChange}
      ></Slider>
      <input
        type="number"
        value={inputValue}
        step={0.1}
        min={0.1}
        onChange={handleInputChange}
        style={{
          width: '50px',
          textAlign: 'center',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '4px',
          marginBottom: '5px',
        }}
      />
    </div>
  );
}

export default OpacitySlider;
