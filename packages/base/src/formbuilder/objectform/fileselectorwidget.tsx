import React, { useState, useEffect, useRef } from 'react';
import { FileDialog } from '@jupyterlab/filebrowser';
import { Dialog } from '@jupyterlab/apputils';
import { CreationFormDialog } from '../../dialogs/formdialog';
import { PathExt } from '@jupyterlab/coreutils';

export const FileSelectorWidget = (props: any) => {
  const { options } = props;
  const { docManager, formOptions } = options;

  const [serverFilePath, setServerFilePath] = useState('');
  const [urlPath, setUrlPath] = useState('');
  const isTypingURL = useRef(false); // Tracks whether the user is manually typing a URL

  useEffect(() => {
    if (!isTypingURL.current && props.value) {
      if (
        props.value.startsWith('http://') ||
        props.value.startsWith('https://')
      ) {
        setUrlPath(props.value);
        setServerFilePath('');
      } else {
        setServerFilePath(props.value);
        setUrlPath('');
      }
    }
  }, [props.value]);

  const handleBrowseServerFiles = async () => {
    try {
      const dialogElement = document.querySelector(
        'dialog[aria-modal="true"]'
      ) as HTMLDialogElement;
      if (dialogElement) {
        const dialogInstance = Dialog.tracker.find(
          dialog => dialog.node === dialogElement
        );

        if (dialogInstance) {
          dialogInstance.resolve(0);
        }
      } else {
        console.warn('No open dialog found.');
      }

      const output = await FileDialog.getOpenFiles({
        title: `Select ${formOptions.sourceType.split('Source')[0]} File`,
        manager: docManager
      });

      if (output.value && output.value.length > 0) {
        const selectedFilePath = output.value[0].path;

        const relativePath = PathExt.relative(
          formOptions.filePath,
          selectedFilePath
        );

        setServerFilePath(relativePath);
        setUrlPath('');
        props.onChange(relativePath);

        if (dialogElement) {
          if (formOptions.sourceType === 'GeoTiffSource') {
            formOptions.dialogOptions.sourceData = {
              ...formOptions.sourceData,
              urls: formOptions.dialogOptions.sourceData.urls.map(
                (urlObject: any) => {
                  return {
                    ...urlObject,
                    url: relativePath
                  };
                }
              )
            };
          } else {
            formOptions.dialogOptions.sourceData = {
              ...formOptions.sourceData,
              path: relativePath
            };
          }

          const formDialog = new CreationFormDialog({
            ...formOptions.dialogOptions
          });
          await formDialog.launch();
        }
      } else {
        if (dialogElement) {
          const formDialog = new CreationFormDialog({
            ...formOptions.dialogOptions
          });
          await formDialog.launch();
        }
      }
    } catch (e) {
      console.error('Error handling file dialog:', e);
    }
  };

  const handleURLChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value.trim();
    isTypingURL.current = true;
    setUrlPath(url);
    setServerFilePath('');
    props.onChange(url);
  };

  const handleURLBlur = () => {
    isTypingURL.current = false;
  };

  return (
    <div>
      <div className="file-container">
        <button className="jp-mod-styled" onClick={handleBrowseServerFiles}>
          Browse Server Files
        </button>
        <p>{serverFilePath || ''}</p>
      </div>

      <div>
        <h3 className="jp-FormGroup-fieldLabel jp-FormGroup-contentItem">
          Or enter external URL
        </h3>
        <input
          type="text"
          id="root_path"
          className="jp-mod-styled"
          onChange={handleURLChange}
          onBlur={handleURLBlur}
          value={urlPath || ''}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};
