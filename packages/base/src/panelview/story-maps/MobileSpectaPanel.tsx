import { IJupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

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

export function MobileSpectaPanel({ model }: IMobileSpectaPanelProps) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(document.getElementById('main'));
  }, []);

  return (
    <div className="jgis-mobile-specta-trigger-wrapper">
      <Drawer direction="bottom" container={container} noBodyStyles={true}>
        <DrawerTrigger asChild>
          <Button>Open Story Panel</Button>
        </DrawerTrigger>
        <DrawerContent>
          <StoryViewerPanel isSpecta={true} isMobile={true} model={model} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
