import {
  faTrash,
  faPaperPlane,
  faArrowsToDot,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IAnnotationModel, IJupyterGISModel } from '@jupytergis/schema';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Button } from '@jupyterlab/ui-components';
import React, { useMemo, useState } from 'react';

import { Message } from './Message';

export interface IAnnotationProps {
  itemId: string;
  annotationModel: IAnnotationModel;
  rightPanelModel?: IJupyterGISModel;
  children?: JSX.Element[] | JSX.Element;
}

const Annotation: React.FC<IAnnotationProps> = ({
  itemId,
  annotationModel,
  rightPanelModel,
  children,
}) => {
  const [messageContent, setMessageContent] = useState('');
  const jgisModel = rightPanelModel;
  const annotation = annotationModel.getAnnotation(itemId);
  const contents = useMemo(() => annotation?.contents ?? [], [annotation]);

  const handleSubmit = () => {
    annotationModel.addContent(itemId, messageContent);
    setMessageContent('');
  };

  const handleDelete = async () => {
    // If the annotation has no content
    // we remove it right away without prompting
    if (!annotationModel.getAnnotation(itemId)?.contents.length) {
      return annotationModel.removeAnnotation(itemId);
    }

    const result = await showDialog({
      title: 'Delete Annotation',
      body: 'Are you sure you want to delete this annotation?',
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Delete' })],
    });

    if (result.button.accept) {
      annotationModel.removeAnnotation(itemId);
    }
  };

  const centerOnAnnotation = () => {
    jgisModel?.centerOnPosition(itemId);
  };

  return (
    <div className="jGIS-Annotation">
      {children}
      <div>
        {contents.map(content => {
          return (
            <Message
              user={content.user}
              message={content.value}
              self={annotationModel.user?.username === content.user?.username}
            />
          );
        })}
      </div>
      <div className="jGIS-Annotation-Message">
        <textarea
          rows={3}
          placeholder={'Ctrl+Enter to submit'}
          value={messageContent}
          onChange={e => setMessageContent(e.currentTarget.value)}
          onKeyDown={e => {
            if (e.ctrlKey && e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
      </div>
      <div className="jGIS-Annotation-Buttons">
        <Button className="jp-mod-styled jp-mod-warn" onClick={handleDelete}>
          <FontAwesomeIcon icon={faTrash} />
        </Button>
        {rightPanelModel && (
          <Button
            className="jp-mod-styled jp-mod-accept"
            onClick={centerOnAnnotation}
          >
            <FontAwesomeIcon icon={faArrowsToDot} />
          </Button>
        )}
        <Button className="jp-mod-styled jp-mod-accept" onClick={handleSubmit}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </Button>
      </div>
    </div>
  );
};

export default Annotation;
