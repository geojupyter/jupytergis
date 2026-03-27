import * as React from 'react';

import {
  PanelTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../shared/components/Tabs';

export interface ITabSpec {
  name: string;
  title: string;
  /** When false the tab is hidden entirely */
  enabled: boolean;
  content: React.ReactNode;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
}

interface IPanelContainerProps {
  tabs: ITabSpec[];
  containerClassName: string;
  curTab: string;
  onTabClick: (name: string) => void;
  style?: React.CSSProperties;
}

export const PanelContainer = React.forwardRef<
  HTMLDivElement,
  IPanelContainerProps
>(({ tabs, containerClassName, curTab, onTabClick, style }, ref) => {
  const enabledTabs = tabs.filter(t => t.enabled);

  return (
    <div ref={ref} className={containerClassName} style={style}>
      <PanelTabs curTab={curTab} className="jgis-panel-tabs">
        <TabsList>
          {enabledTabs.map(tab => (
            <TabsTrigger
              className="jGIS-layer-browser-category"
              key={tab.name}
              value={tab.name}
              onClick={() => onTabClick(tab.name)}
            >
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(
          tab =>
            tab.enabled && (
              <TabsContent
                key={tab.name}
                value={tab.name}
                className={`jgis-panel-tab-content${tab.contentClassName ? ` ${tab.contentClassName}` : ''}`}
                style={tab.contentStyle}
              >
                {tab.content}
              </TabsContent>
            ),
        )}
      </PanelTabs>
    </div>
  );
});

PanelContainer.displayName = 'PanelContainer';
