import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RgbaColorPicker as ReactColorfulRgba } from 'react-colorful';

import {
  RgbaChannel,
  RgbaColor,
  RGBA_INDEX,
} from '@/src/dialogs/symbology/colorRampUtils';

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

  const [inputs, setInputs] = useState({
    r: String(Math.round(r)),
    g: String(Math.round(g)),
    b: String(Math.round(b)),
    a: String(Math.round(a * 100)),
  });

  // Sync text inputs when color changes externally (e.g. picker drag)
  useEffect(() => {
    setInputs({
      r: String(Math.round(r)),
      g: String(Math.round(g)),
      b: String(Math.round(b)),
      a: String(Math.round(a * 100)),
    });
  }, [r, g, b, a]);

  const swatchStyle = {
    background: `rgba(${r},${g},${b},${a})`,
    width: 28,
    height: 28,
    borderRadius: 4,
    border: '1px solid var(--jp-border-color1, #ccc)',
    cursor: 'pointer',
    flexShrink: 0,
  };

  const handlePickerChange = useCallback(
    (c: { r: number; g: number; b: number; a: number }) => {
      onChange([c.r, c.g, c.b, c.a]);
    },
    [onChange],
  );

  const handleChannelInput = (channel: RgbaChannel, value: string) => {
    setInputs(prev => ({ ...prev, [channel]: value }));
    const num = Number(value);
    if (channel === 'a') {
      if (num >= 0 && num <= 100) {
        onChange([r, g, b, num / 100]);
      }
    } else {
      if (num >= 0 && num <= 255) {
        const newColor: RgbaColor = [...color];
        newColor[RGBA_INDEX[channel]] = Math.round(num);
        onChange(newColor);
      }
    }
  };

  const handleTransparentChange = (checked: boolean) => {
    // Always restore to fully opaque rather than the previous alpha,
    // which could have been near-zero and appear broken to the user.
    onChange([r, g, b, checked ? 0 : 1]);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignore clicks on detached nodes (can happen when a React re-render
      // removes the target between pointerdown and mousedown).
      if (!document.documentElement.contains(target)) {
        return;
      }
      if (containerRef.current && !containerRef.current.contains(target)) {
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
            left: 0,
            background: 'var(--jp-layout-color1, #fff)',
            border: '1px solid var(--jp-border-color1, #ccc)',
            borderRadius: 6,
            padding: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <ReactColorfulRgba
            color={{ r, g, b, a }}
            onChange={handlePickerChange}
          />
          <div className="jp-gis-rgba-inputs">
            {(['r', 'g', 'b'] as const).map(ch => (
              <div key={ch} className="jp-gis-rgba-field">
                <label>{ch.toUpperCase()}</label>
                <input
                  className="jp-mod-styled"
                  type="number"
                  min={0}
                  max={255}
                  value={inputs[ch]}
                  onChange={e => handleChannelInput(ch, e.target.value)}
                />
              </div>
            ))}
            <div className="jp-gis-rgba-field">
              <label>A%</label>
              <input
                className="jp-mod-styled"
                type="number"
                min={0}
                max={100}
                value={inputs.a}
                onChange={e => handleChannelInput('a', e.target.value)}
              />
            </div>
          </div>
          <label className="jp-gis-transparent-label">
            <input
              type="checkbox"
              checked={a === 0}
              onChange={e => handleTransparentChange(e.target.checked)}
            />
            No color
          </label>
        </div>
      )}
    </div>
  );
};

export default RgbaColorPicker;
