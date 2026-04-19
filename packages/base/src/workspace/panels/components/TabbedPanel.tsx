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
  curTab: string;
  onTabClick: (name: string) => void;
  onTabListMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onTabListTouchStart?: React.TouchEventHandler<HTMLDivElement>;
}

export const TabbedPanel: React.FC<ITabbedPanelProps> = ({
  tabs,
  curTab,
  onTabClick,
  onTabListMouseDown,
  onTabListTouchStart,
}) => {
  const enabledTabs = tabs.filter(tab => tab.enabled);
  const tabsListRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const list = tabsListRef.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (list && active) {
      const listCenter = list.offsetWidth / 2;
      const triggerCenter = active.offsetLeft + active.offsetWidth / 2;
      list.scrollLeft = triggerCenter - listCenter;
    }
  }, [curTab]);

  return (
    <TabsRoot className="jgis-panel-tabs" curTab={curTab}>
      <TabsList
        ref={tabsListRef}
        onMouseDown={onTabListMouseDown}
        onTouchStart={onTabListTouchStart}
      >
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
  );
};
