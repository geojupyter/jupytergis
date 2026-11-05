import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useEffect } from 'react';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shared/components/Accordion';
import { Button } from '../../shared/components/Button';
import { cn } from '../../shared/components/utils';
import {
  type FloatingPanelId,
  useFloatingPanelAccordion,
} from './floatingPanelDock';

interface IFloatingRightPanelProps {
  value: FloatingPanelId;
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
  const { openValues, registerOpen } = useFloatingPanelAccordion();
  const isOpen = openValues.includes(value);

  useEffect(() => registerOpen(value), [value, registerOpen]);

  return (
    <AccordionItem
      value={value}
      className={cn(
        'jgis-floating-right-panel border-none',
        !isOpen && 'jgis-floating-right-panel-collapsed',
      )}
    >
      <div className="jgis-floating-right-panel-shell">
        <AccordionTrigger
          hideChevron
          render={
            <Button
              variant={isOpen ? 'ghost' : 'outline'}
              size={isOpen ? 'sm' : 'icon'}
              className={cn(
                'jgis-floating-right-panel-header h-(--jgis-floating-panel-chip-size) w-full justify-center no-underline shadow-none hover:no-underline',
                isOpen && 'gap-1.5 rounded-none bg-secondary',
                !isOpen && 'size-(--jgis-floating-panel-chip-size)',
              )}
            />
          }
          className="flex w-full flex-none items-center justify-center border-0 border-b border-b-border p-0 no-underline hover:no-underline"
          title={title}
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
