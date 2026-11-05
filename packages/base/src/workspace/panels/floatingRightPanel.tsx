import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shared/components/Accordion';
import { Button } from '../../shared/components/Button';
import { cn } from '../../shared/components/utils';
import { useFloatingPanelAccordion } from './floatingPanelDock';

interface IFloatingRightPanelProps {
  value: string;
  title: string;
  children: ReactNode;
  icon?: LabIcon;
}

export function FloatingRightPanel({
  value,
  title,
  children,
  icon,
}: IFloatingRightPanelProps): JSX.Element {
  const { openValues, setOpenValues } = useFloatingPanelAccordion();
  const isOpen = openValues.includes(value);

  const nodeRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [undockTop, setUndockTop] = useState(0);
  const [isUndocked, setIsUndocked] = useState(false);
  const didDragRef = useRef(false);

  useEffect(() => {
    setOpenValues(current =>
      current.includes(value) ? current : [...current, value],
    );

    return () => {
      setOpenValues(current => current.filter(item => item !== value));
    };
  }, [value, setOpenValues]);

  useEffect(() => {
    if (!isOpen) {
      setPosition({ x: 0, y: 0 });
      setIsUndocked(false);
      setUndockTop(0);
    }
  }, [isOpen]);

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
    <AccordionItem
      value={value}
      className={cn(
        'jgis-floating-right-panel border-none',
        !isOpen && 'jgis-floating-right-panel-collapsed',
        isUndocked && 'jgis-floating-right-panel-undocked',
      )}
      style={isUndocked ? { top: undockTop } : undefined}
    >
      {/* Drag re-enabled later; shell keeps chrome + width animation. */}
      <div ref={nodeRef} className="jgis-floating-right-panel-shell">
        <AccordionTrigger
          hideChevron
          render={
            <Button
              variant={isOpen ? 'ghost' : 'outline'}
              size={isOpen ? 'sm' : 'icon'}
              className={cn(
                'jgis-floating-right-panel-header h-9 w-full justify-center no-underline shadow-none hover:no-underline',
                isOpen && 'gap-1.5 rounded-none bg-secondary',
                !isOpen && 'size-9',
              )}
            />
          }
          className="flex w-full flex-none items-center justify-center border-0 border-b border-b-border p-0 no-underline hover:no-underline"
          data-drag-handle
          title={title}
          onClickCapture={event => {
            if (didDragRef.current) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          {icon ? <icon.react tag="span" className="size-4" /> : null}
          <span className="jgis-floating-right-panel-title">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="jgis-floating-right-panel-body">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}
