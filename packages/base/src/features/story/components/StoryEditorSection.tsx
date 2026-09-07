import React, { useId } from 'react';

import {
  CollapsibleTrigger,
  Collapsible,
  CollapsibleContentAnimated,
  CollapsibleHeader,
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
        render={
          <CollapsibleHeader title={triggerText} titleId={triggerId} />
        }
      />
      <CollapsibleContentAnimated className="jgis-story-editor-section-body">
        {children}
      </CollapsibleContentAnimated>
    </Collapsible>
  );
}
