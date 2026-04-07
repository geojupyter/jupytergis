import * as React from 'react';

import {
  TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../shared/components/Tabs';
import { cn } from '../../../shared/components/utils';

export interface ITabConfig {
  name: string;
  title: string;
  enabled: boolean;
  contentClassName?: string;
  content: React.ReactNode;
}

interface ITabbedPanelProps {
  tabs: ITabConfig[];
  containerClassName: string;
  curTab: string;
  onTabClick: (name: string) => void;
  style?: React.CSSProperties;
}

export const TabbedPanel: React.FC<ITabbedPanelProps> = ({
  tabs,
  containerClassName,
  curTab,
  onTabClick,
  style,
}) => {
  const enabledTabs = tabs.filter(tab => tab.enabled);

  return (
    <div className={containerClassName} style={style}>
      <TabsRoot className="jgis-panel-tabs" curTab={curTab}>
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
        {enabledTabs.map(tab => (
          <TabsContent
            key={tab.name}
            value={tab.name}
            className={cn('jgis-panel-tab-content', tab.contentClassName)}
          >
            {tab.content}
          </TabsContent>
        ))}
      </TabsRoot>
    </div>
  );
};
