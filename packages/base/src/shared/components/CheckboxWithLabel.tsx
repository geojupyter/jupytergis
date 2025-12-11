import React from 'react';

import Checkbox from '@/src/shared/components/Checkbox';

interface ICheckboxWithLabelProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

const CheckboxWithLabel: React.FC<ICheckboxWithLabelProps> = ({
  checked,
  onCheckedChange,
  label,
}) => {
  return (
    <div>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        {label}
      </span>
    </div>
  );
};

export default CheckboxWithLabel;
