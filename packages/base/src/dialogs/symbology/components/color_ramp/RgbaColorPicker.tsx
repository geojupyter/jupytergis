import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RgbaColorPicker as ReactColorfulRgba } from 'react-colorful';

import { RgbaColor } from '@/src/dialogs/symbology/colorRampUtils';

export type { RgbaColor };

interface IRgbaColorPickerProps {
  color: RgbaColor;
  onChange: (color: RgbaColor) => void;
}

/**
 * A swatch button that opens a floating RGBA color picker on click.
 * Color is stored as [r, g, b, a] where r/g/b are 0-255 and a is 0-1.
 */
const RgbaColorPicker: React.FC<IRgbaColorPickerProps> = ({
  color,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [r, g, b, a] = color;
  const swatchStyle = {
    background: `rgba(${r},${g},${b},${a})`,
    width: 28,
    height: 28,
    borderRadius: 4,
    border: '1px solid var(--jp-border-color1, #ccc)',
    cursor: 'pointer',
    flexShrink: 0,
  };

  const handleChange = useCallback(
    (c: { r: number; g: number; b: number; a: number }) => {
      onChange([c.r, c.g, c.b, c.a]);
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="jp-gis-rgba-picker"
      style={{ position: 'relative' }}
    >
      <div style={swatchStyle} onClick={() => setOpen(v => !v)} />
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '110%',
            right: 0,
            background: 'var(--jp-layout-color1, #fff)',
            border: '1px solid var(--jp-border-color1, #ccc)',
            borderRadius: 6,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <ReactColorfulRgba color={{ r, g, b, a }} onChange={handleChange} />
        </div>
      )}
    </div>
  );
};

export default RgbaColorPicker;
