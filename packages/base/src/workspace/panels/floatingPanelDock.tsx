import * as React from 'react';

import { Accordion } from '../../shared/components/Accordion';

interface IFloatingPanelAccordionContext {
  openValues: string[];
  setOpenValues: React.Dispatch<React.SetStateAction<string[]>>;
}

const FloatingPanelAccordionContext =
  React.createContext<IFloatingPanelAccordionContext | null>(null);

export function useFloatingPanelAccordion(): IFloatingPanelAccordionContext {
  const context = React.useContext(FloatingPanelAccordionContext);
  if (!context) {
    throw new Error(
      'useFloatingPanelAccordion must be used within FloatingPanelDock',
    );
  }
  return context;
}

interface IFloatingPanelDockProps {
  children: React.ReactNode;
}

/**
 * Top-right accordion dock that stacks floating panels.
 * Multiple panels may be expanded at once.
 */
export function FloatingPanelDock({
  children,
}: IFloatingPanelDockProps): JSX.Element {
  const [openValues, setOpenValues] = React.useState<string[]>([]);

  return (
    <FloatingPanelAccordionContext.Provider
      value={{ openValues, setOpenValues }}
    >
      <Accordion
        multiple
        value={openValues}
        onValueChange={nextValues => setOpenValues(nextValues)}
        className="jgis-floating-panel-dock w-auto"
      >
        {children}
      </Accordion>
    </FloatingPanelAccordionContext.Provider>
  );
}
