import { Dialog, showDialog } from '@jupyterlab/apputils';
import { TranslationBundle } from '@jupyterlab/translation';
import React from 'react';

import { version } from '@/package.json';
import { logoIcon } from '../shared/icons';

const CONTRIBUTORS_URL =
  'https://github.com/geojupyter/jupytergis/graphs/contributors';
const ABOUT_URL = 'https://jupytergis.readthedocs.io';

export async function showAboutDialog(trans: TranslationBundle): Promise<void> {
  const versionNumber = trans.__('Version %1', version);
  const versionInfo = (
    <span className="jp-About-version-info">
      <span className="jp-About-version">{versionNumber}</span>
    </span>
  );

  const title = (
    <span className="jp-About-header">
      <logoIcon.react margin="7px 9.5px" height="auto" width="58px" />
      <div className="jp-About-header-info">
        <span className="jp-About-header-wordmark">
          Jupyter<span className="text-[#32A6C3]">GIS</span>
        </span>
        {versionInfo}
      </div>
    </span>
  );

  const body = (
    <div className="jp-About-body">
      <span className="jp-About-externalLinks">
        <a
          href={CONTRIBUTORS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="jp-Button-flat"
        >
          {trans.__('CONTRIBUTOR LIST')}
        </a>
        <a
          href={ABOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="jp-Button-flat"
        >
          {trans.__('JUPYTERGIS DOCUMENTATION')}
        </a>
      </span>
      <span className="jp-About-copyright">
        {trans.__('© JupyterGIS Contributors')}
      </span>
    </div>
  );

  await showDialog({
    title,
    body,
    buttons: [
      Dialog.cancelButton({
        label: trans.__('Close'),
      }),
    ],
  });
}
