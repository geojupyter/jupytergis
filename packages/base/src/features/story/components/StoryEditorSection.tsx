import { ChevronRightIcon } from 'lucide-react';
import React, { useId } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from '@/src/shared/components/Collapsible';

interface IStoryEditorSectionProps {
  triggerText: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function StoryEditorSection({
  children,
  triggerText,
  open,
  onOpenChange,
  defaultOpen,
}: IStoryEditorSectionProps) {
  const triggerId = useId();

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      asChild
    >
      <section
        className="jgis-story-editor-section"
        aria-labelledby={triggerId}
      >
        <CollapsibleTrigger asChild>
          <div className="jgis-story-editor-section-trigger">
            <Button
              size="icon-sm"
              variant="icon"
              className="jgis-rotate-90 jgis-bg-transparent"
            >
              <ChevronRightIcon data-icon="inline-start" />
            </Button>
            <span id={triggerId}>{triggerText}</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="jgis-story-editor-section-body">
          {children}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
