import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from './utils';

interface IPanelTabProps {
  className: string;
  curTab: string | undefined;
  children: any;
}
const Tabs: React.FC<React.ComponentProps<typeof TabsPrimitive.Root>> = ({
  className,
  ...props
}) => {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('TabsList', className)}
      {...props}
    />
  );
};

const PanelTabs: React.FC<IPanelTabProps> = ({
  className,
  curTab,
  children,
}) => {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('TabsList', className)}
      value={curTab}
      onValueChange={() => {
        return;
      }}
      children={children}
    />
  );
};

const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({
  className,
  ...props
}) => {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('jgis-tabs-list', className)}
      {...props}
    />
  );
};

const TabsTrigger: React.FC<
  React.ComponentProps<typeof TabsPrimitive.Trigger>
> = ({ className, ...props }) => {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn('jgis-tabs-trigger', className)}
      {...props}
    />
  );
};

const TabsContent: React.FC<
  React.ComponentProps<typeof TabsPrimitive.Content>
> = ({ className, ...props }) => {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('jgis-tabs-content', className)}
      {...props}
    />
  );
};

export { Tabs, TabsContent, TabsList, TabsTrigger, PanelTabs };
