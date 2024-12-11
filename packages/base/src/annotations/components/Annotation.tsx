import { faTrash, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IAnnotationModel } from '@jupytergis/schema';
import { showDialog, Dialog } from '@jupyterlab/apputils';
import { Button } from '@jupyterlab/ui-components';
import React, { useMemo, useState } from 'react';
import { Message } from './Message';

export interface IAnnotationProps {
  itemId: string;
  model: IAnnotationModel;
  children?: JSX.Element[] | JSX.Element;
}

const Annotation = ({ itemId, model, children }: IAnnotationProps) => {
  const [messageContent, setMessageContent] = useState('');

  const annotation = model.getAnnotation(itemId);
  const contents = useMemo(() => annotation?.contents ?? [], [annotation]);

  const handleSubmit = () => {
    model.addContent(itemId, messageContent);
    setMessageContent('');
  };

  const handleDelete = async () => {
    // If the annotation has no content
    // we remove it right away without prompting
    if (!model.getAnnotation(itemId)?.contents.length) {
      return model.removeAnnotation(itemId);
    }

    const result = await showDialog({
      title: 'Delete Annotation',
      body: 'Are you sure you want to delete this annotation?',
      buttons: [Dialog.cancelButton(), Dialog.okButton({ label: 'Delete' })]
    });

    if (result.button.accept) {
      model.removeAnnotation(itemId);
    }
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
              self={model.user?.username === content.user?.username}
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
        <Button className="jp-mod-styled jp-mod-accept" onClick={handleSubmit}>
          <FontAwesomeIcon icon={faPaperPlane} />
        </Button>
      </div>
    </div>
  );
};

export default Annotation;
