import * as React from 'react';

import { Accordion } from '../../shared/components/Accordion';

export const FloatingPanelId = {
  Annotations: 'annotations',
  Identify: 'identify',
  STAC: 'stac',
} as const;

export type FloatingPanelId =
  (typeof FloatingPanelId)[keyof typeof FloatingPanelId];

interface IFloatingPanelAccordionContext {
  openValues: FloatingPanelId[];
  registerOpen: (value: FloatingPanelId) => () => void;
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
 * Top-right accordion that stacks floating panels.
 */
export function FloatingPanelDock({
  children,
}: IFloatingPanelDockProps): JSX.Element {
  const [openValues, setOpenValues] = React.useState<FloatingPanelId[]>([]);

  const registerOpen = React.useCallback((value: FloatingPanelId) => {
    setOpenValues(current =>
      current.includes(value) ? current : [...current, value],
    );

    return () => {
      setOpenValues(current => current.filter(item => item !== value));
    };
  }, []);

  return (
    <FloatingPanelAccordionContext.Provider
      value={{ openValues, registerOpen }}
    >
      <Accordion
        multiple
        value={openValues}
        onValueChange={nextValues =>
          setOpenValues(nextValues as FloatingPanelId[])
        }
        className="jgis-floating-panel-dock w-auto"
      >
        {children}
      </Accordion>
    </FloatingPanelAccordionContext.Provider>
  );
}
