import { ChevronRightIcon } from 'lucide-react';
import React, { useId } from 'react';

import { ButtonTw } from '@/src/shared/components/ButtonTw';
import {
  CollapsibleTrigger,
  Collapsible,
  CollapsibleContentAnimated,
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
      render={
        <section
          className="jgis-story-editor-section"
          aria-labelledby={triggerId}
        />
      }
    >
      <CollapsibleTrigger
        nativeButton={false}
        render={<div className="jgis-story-editor-section-trigger" />}
      >
        <ButtonTw
          size="icon-sm"
          variant="ghost"
          className="jgis-rotate-90 hover:bg-transparent"
        >
          <ChevronRightIcon data-icon="inline-start" />
        </ButtonTw>
        <span id={triggerId}>{triggerText}</span>
      </CollapsibleTrigger>
      <CollapsibleContentAnimated className="jgis-story-editor-section-body">
        {children}
      </CollapsibleContentAnimated>
    </Collapsible>
  );
}
