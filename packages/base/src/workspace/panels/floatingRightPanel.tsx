import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useRef, useState } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

import { cn } from '../../shared/components/utils';

interface IFloatingRightPanelProps {
  title: string;
  children: ReactNode;
  icon?: LabIcon;
}

export function FloatingRightPanel({
  title,
  children,
  icon,
}: IFloatingRightPanelProps): JSX.Element {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [undockTop, setUndockTop] = useState(0);
  const [isUndocked, setIsUndocked] = useState(false);
  const didDragRef = useRef(false);

  const handleHeaderClick = () => {
    if (didDragRef.current) {
      return;
    }

    setIsOpen(open => {
      if (open) {
        setPosition({ x: 0, y: 0 });
        setIsUndocked(false);
        setUndockTop(0);
      }
      return !open;
    });
  };

  const handleDragStart = () => {
    didDragRef.current = false;
    const node = nodeRef.current;
    if (node && !isUndocked) {
      setUndockTop(node.offsetTop);
      setIsUndocked(true);
    }
  };

  const handleDrag = (_event: DraggableEvent, data: DraggableData) => {
    didDragRef.current = true;
    setPosition({ x: data.x, y: data.y });
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle="[data-drag-handle]"
      bounds=".jGIS-Mainview-Container"
      disabled={!isOpen}
      position={position}
      onStart={handleDragStart}
      onDrag={handleDrag}
    >
      <div
        ref={nodeRef}
        className={cn(
          'jgis-floating-right-panel',
          !isOpen && 'jgis-floating-right-panel-collapsed',
          isUndocked && 'jgis-floating-right-panel-undocked',
        )}
        style={isUndocked ? { top: undockTop } : undefined}
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
