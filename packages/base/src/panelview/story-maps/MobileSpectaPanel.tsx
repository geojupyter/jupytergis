import * as React from 'react';

import { Button } from '@/src/shared/components/Button';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/src/shared/components/Drawer';
import StoryViewerPanel from './StoryViewerPanel';
import { IJupyterGISModel } from '@jupytergis/schema';
import {
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Sheet,
} from '@/src/shared/components/Sheet';

interface IMobileSpectaPanelProps {
  model: IJupyterGISModel;
}

export function MobileSpectaPanel({ model }: IMobileSpectaPanelProps) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(document.getElementById('main'));
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        position: 'fixed',
        bottom: '1.25rem',
      }}
    >
      <Drawer direction="bottom" container={container} noBodyStyles={true}>
        <DrawerTrigger asChild>
          <Button>Open Story Panel</Button>
        </DrawerTrigger>
        <DrawerContent>
          <StoryViewerPanel isSpecta={true} model={model} />
        </DrawerContent>
      </Drawer>
      {/* <Sheet>
        <SheetTrigger style={{ position: 'fixed', top: 0 }} asChild>
          <Button>Open Story Panel</Button>
        </SheetTrigger>
        <SheetContent side="bottom" container={container!}>
          <StoryViewerPanel isSpecta={true} model={model} />
        </SheetContent>
      </Sheet> */}
    </div>
  );
}
