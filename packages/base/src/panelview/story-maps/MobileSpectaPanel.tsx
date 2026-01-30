import { IJupyterGISModel } from '@jupytergis/schema';
import React, { CSSProperties, useEffect, useState } from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
} from '@/src/shared/components/Drawer';
import StoryViewerPanel from './StoryViewerPanel';

interface IMobileSpectaPanelProps {
  model: IJupyterGISModel;
}

function getSpectaPresentationStyle(model: IJupyterGISModel): CSSProperties {
  const story = model.getSelectedStory().story;
  const bgColor = story?.presentationBgColor;
  const textColor = story?.presentaionTextColor;

  const style: CSSProperties = {};
  if (bgColor) {
    (style as Record<string, string>)['--jgis-specta-bg-color'] = bgColor;
    style.backgroundColor = bgColor;
  }
  if (textColor) {
    (style as Record<string, string>)['--jgis-specta-text-color'] = textColor;
    style.color = textColor;
  }
  return style;
}

export function MobileSpectaPanel({ model }: IMobileSpectaPanelProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const presentationStyle = getSpectaPresentationStyle(model);

  useEffect(() => {
    setContainer(document.getElementById('main'));
  }, []);

  return (
    <div className="jgis-mobile-specta-trigger-wrapper">
      <Drawer direction="bottom" container={container} noBodyStyles={true}>
        <DrawerTrigger asChild>
          <Button>Open Story Panel</Button>
        </DrawerTrigger>
        <DrawerContent style={presentationStyle}>
          <StoryViewerPanel isSpecta={true} isMobile={true} model={model} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
