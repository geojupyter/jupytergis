import { Tabs as TabsPrimitive } from 'radix-ui';
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

const TabsRoot: React.FC<IPanelTabProps> = ({
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
  children,
  ...props
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollButtons = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    updateScrollButtons();
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      ro.disconnect();
    };
  }, [updateScrollButtons]);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="jgis-tabs-list-wrapper">
      <button
        className="jgis-tabs-scroll-btn"
        style={{ visibility: canScrollLeft ? 'visible' : 'hidden' }}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => scrollBy(-80)}
        tabIndex={-1}
        aria-label="Scroll tabs left"
      >
        ‹
      </button>
      <div ref={scrollRef} className="jgis-tabs-list-scroll">
        <TabsPrimitive.List
          data-slot="tabs-list"
          className={cn('jgis-tabs-list', className)}
          {...props}
        >
          {children}
        </TabsPrimitive.List>
      </div>
      <button
        className="jgis-tabs-scroll-btn"
        style={{ visibility: canScrollRight ? 'visible' : 'hidden' }}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => scrollBy(80)}
        tabIndex={-1}
        aria-label="Scroll tabs right"
      >
        ›
      </button>
    </div>
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

export { Tabs, TabsContent, TabsList, TabsTrigger, TabsRoot };
