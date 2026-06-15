import { Button } from '@/src/shared/components/Button';
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from '@/src/shared/components/Collapsible';
import { ChevronRightIcon } from 'lucide-react';
import React from 'react';

interface StoryEditorSectionProps {
  triggerText: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

function StoryEditorSection({
  children,
  triggerText,
  open,
  onOpenChange,
  defaultOpen,
}: StoryEditorSectionProps) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
    >
      <CollapsibleTrigger asChild>
        <div className="jgis-symbology-override-collapsible-trigger">
          <Button
            size="icon-sm"
            variant="icon"
            className="jgis-rotate-90 jgis-bg-transparent"
            data-icon="inline-start"
          >
            <ChevronRightIcon />
          </Button>
          <span>{triggerText}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default StoryEditorSection;
