import {
  IJupyterGISModel,
  IJupyterGISTracker,
  IJupyterGISWidget,
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

import StacPanelView from '@/src/stacBrowser/components/StacPanelView';
import { IControlPanelModel } from '@/src/types';

interface IStacBrowserDialogProps {
  controlPanelModel: IControlPanelModel;
}

const StacBrowser = ({ controlPanelModel }: IStacBrowserDialogProps) => {
  const [jgisModel, setJgisModel] = useState<IJupyterGISModel | undefined>(
    controlPanelModel?.jGISModel,
  );

  useEffect(() => {
    const handleCurrentChanged = (
      _: IJupyterGISTracker,
      widget: IJupyterGISWidget | null,
    ) => {
      setJgisModel(widget?.model);
    };

    controlPanelModel.documentChanged.connect(handleCurrentChanged);

    return () => {
      controlPanelModel.documentChanged.disconnect(handleCurrentChanged);
    };
  }, [controlPanelModel]);

  return <StacPanelView model={jgisModel} />;
};
export default StacBrowser;
