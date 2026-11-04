import * as React from 'react';

interface IFloatingPanelDockProps {
  children: React.ReactNode;
}

/**
 * Top-right flex column that stacks floating panel chips / expanded panels.
 */
export function FloatingPanelDock({
  children,
}: IFloatingPanelDockProps): JSX.Element {
  return <div className="jgis-floating-panel-dock">{children}</div>;
}
