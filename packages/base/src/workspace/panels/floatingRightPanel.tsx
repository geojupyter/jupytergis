import { LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode, useEffect } from 'react';

import {
  type FloatingPanelId,
  useFloatingPanelAccordion,
} from './floatingPanelDock';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../shared/components/Accordion';

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
  const { registerOpen } = useFloatingPanelAccordion();

  useEffect(() => registerOpen(value), [value, registerOpen]);

  return (
    <AccordionItem
      value={value}
      className="jgis-floating-right-panel border-none"
    >
      <div className="jgis-floating-right-panel-shell">
        <AccordionTrigger
          variant="plain"
          hideChevron
          className="jgis-floating-right-panel-header"
          title={title}
        >
          {icon ? (
            <icon.react tag="span" className="jgis-floating-right-panel-icon" />
          ) : null}
          <span className="jgis-floating-right-panel-title">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="jgis-floating-right-panel-body">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}
