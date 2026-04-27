import React from 'react';

import Checkbox from '@/src/shared/components/Checkbox';

interface IStacSpatialExtentProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

const StacSpatialExtent: React.FC<IStacSpatialExtentProps> = ({
  checked,
  onCheckedChange,
  label,
}) => {
  return (
    <>
      <label className="jgis-stac-filter-extension-label">Spatial Extent</label>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Checkbox checked={checked} onCheckedChange={onCheckedChange} />
        {label}
      </span>
    </>
  );
};

export default StacSpatialExtent;
