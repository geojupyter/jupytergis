import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useRef, useState } from 'react';
import Draggable from 'react-draggable';

import { cn } from '../../shared/components/utils';

interface IFloatingRightPanelProps {
  title: string;
  children: ReactNode;
  icon?: LabIcon;
  defaultPosition?: { x: number; y: number };
}

export function FloatingRightPanel({
  title,
  children,
  icon,
  defaultPosition,
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
      defaultPosition={defaultPosition}
      onStart={() => {
        didDragRef.current = false;
      }}
      onDrag={() => {
        didDragRef.current = true;
      }}
    >
      <div
        className={cn(
          'jgis-right-panel-container jgis-floating-right-panel',
          !isOpen && 'jgis-floating-right-panel-collapsed',
        )}
      >
        <div
          className="jgis-floating-right-panel-header"
          data-drag-handle
          role="button"
          aria-expanded={isOpen}
          aria-label={title}
          title={title}
          onClick={handleHeaderClick}
        >
          {icon ? (
            <icon.react
              tag="span"
              className="jgis-floating-right-panel-icon"
            />
          ) : null}
          {isOpen ? (
            <span className="jgis-floating-right-panel-title">{title}</span>
          ) : null}
        </div>
        <div className="jgis-floating-right-panel-body" hidden={!isOpen}>
          {children}
        </div>
      </div>
    </Draggable>
  );
}
