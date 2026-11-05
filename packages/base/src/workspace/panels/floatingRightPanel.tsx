import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useEffect } from 'react';

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shared/components/Accordion';
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
          variant="plain"
          hideChevron
          className="jgis-floating-right-panel-header"
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
