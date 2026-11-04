import React, { ReactNode, useRef, useState } from 'react';
import Draggable from 'react-draggable';

interface IFloatingRightPanelProps {
  title: string;
  children: ReactNode;
}

export function FloatingRightPanel({
  title,
  children,
}: IFloatingRightPanelProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(true);
  const didDragRef = useRef(false);

  const handleHeaderClick = () => {
    if (didDragRef.current) {
      return;
    }

    setIsOpen(open => !open);
  };

  return (
    <Draggable
      handle="[data-drag-handle]"
      bounds=".jGIS-Mainview-Container"
      onStart={() => {
        didDragRef.current = false;
      }}
      onDrag={() => {
        didDragRef.current = true;
      }}
    >
      <div className="jgis-right-panel-container jgis-floating-right-panel">
        <div
          className="jgis-floating-right-panel-header"
          data-drag-handle
          role="button"
          aria-expanded={isOpen}
          onClick={handleHeaderClick}
        >
          {title}
        </div>
        <div className="jgis-floating-right-panel-body" hidden={!isOpen}>
          {children}
        </div>
      </div>
    </Draggable>
  );
}
