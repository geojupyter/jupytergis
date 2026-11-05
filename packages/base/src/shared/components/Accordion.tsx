import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import React from 'react';

import { cn } from './utils';

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn('flex w-full flex-col', className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('not-last:border-b', className)}
      {...props}
    />
  );
}

interface IAccordionTriggerProps extends AccordionPrimitive.Trigger.Props {
  hideChevron?: boolean;
}

function AccordionTrigger({
  className,
  children,
  hideChevron = false,
  ...props
}: IAccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground',
          className,
        )}
        {...props}
      >
        {children}
        {!hideChevron ? (
          <>
            <ChevronDownIcon
              data-slot="accordion-trigger-icon"
              className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
            />
            <ChevronUpIcon
              data-slot="accordion-trigger-icon"
              className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
            />
          </>
        ) : null}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div
        className={cn(
          'pt-0 pb-2.5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4',
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
