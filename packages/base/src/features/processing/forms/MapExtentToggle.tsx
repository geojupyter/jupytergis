import React from 'react';

interface IMapExtentToggleProps {
  isActive: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
}

/**
 * Checkbox that locks the extent fields to the current map viewport.
 * When active, the children (extent fields) are visually dimmed and
 * pointer-events are disabled so the user cannot edit them.
 */
export function MapExtentToggle({
  isActive,
  onChange,
  children,
}: IMapExtentToggleProps): React.ReactElement {
  return (
    <>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          margin: '4px 0 8px',
          cursor: 'pointer',
          fontSize: 'var(--jp-ui-font-size1)',
        }}
      >
        <input type="checkbox" checked={isActive} onChange={onChange} />
        Use current map extent
      </label>

      <div
        style={isActive ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
      >
        {children}
      </div>
    </>
  );
}
