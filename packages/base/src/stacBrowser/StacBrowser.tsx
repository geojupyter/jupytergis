import { IJupyterGISModel } from '@jupytergis/schema';

import StacPanelView from '@/src/stacBrowser/components/StacPanelView';
import * as React from 'react';

interface IStacBrowserDialogProps {
	controlPanelModel: IJupyterGISModel;
}

const StacBrowser = ({ controlPanelModel: model }: IStacBrowserDialogProps) => {
	const jgisModel = model;

	return <StacPanelView model={jgisModel} />;
};
export default StacBrowser;
