import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from './utils';

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

const TabsList: React.FC<React.ComponentProps<typeof TabsPrimitive.List>> = ({
  className,
  ...props
}) => {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('TabsList', className)}
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
      className={cn('TabsTrigger', className)}
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
      className={cn('TabsContent', className)}
      {...props}
    />
  );
};

export { Tabs, TabsContent, TabsList, TabsTrigger };
