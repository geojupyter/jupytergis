import { IAnnotationModel } from '@jupytergis/schema';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { caretRightIcon, closeIcon } from '@jupyterlab/ui-components';
import { Message } from './message';
import { minimizeIcon } from '../icons';
import React, { useMemo, useState } from 'react';

interface IAnnotationProps {
  itemId: string;
  model: IAnnotationModel;
  children?: JSX.Element[] | JSX.Element;
}

interface IFloatingAnnotationProps extends IAnnotationProps {
  open: boolean;
}

export const Annotation = (props: IAnnotationProps): JSX.Element => {
  const { itemId, model } = props;
  const annotation = model.getAnnotation(itemId);
  const contents = useMemo(() => annotation?.contents ?? [], [annotation]);

  const [messageContent, setMessageContent] = useState<string>('');

  if (!annotation) {
    return <div></div>;
  }

  const submitMessage = () => {
    model.addContent(itemId, messageContent);
    setMessageContent('');
  };

  return (
    <div className="jgis-Annotation">
      {props.children}
      <div style={{ paddingBottom: 10, maxHeight: 400, overflow: 'auto' }}>
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
      <div className="jgis-Annotation-Message">
        <textarea
          rows={3}
          placeholder={'Ctrl+Enter to submit'}
          value={messageContent}
          onChange={e => setMessageContent(e.currentTarget.value)}
          onKeyDown={e => {
            if (e.ctrlKey && e.key === 'Enter') {
              submitMessage();
            }
          }}
        />
        <div onClick={submitMessage}>
          <caretRightIcon.react className="jgis-Annotation-Submit" />
        </div>
      </div>
    </div>
  );
};

export const FloatingAnnotation = (
  props: IFloatingAnnotationProps
): JSX.Element => {
  const { itemId, model } = props;

  const [open, setOpen] = useState(props.open);

  // Function that either
  // - opens the annotation if `open`
  // - removes the annotation if `!open` and the annotation is empty
  // - closes the annotation if `!open` and the annotation is not empty
  const setOpenOrDelete = (open: boolean) => {
    if (open) {
      return setOpen(true);
    }

    if (!model.getAnnotation(itemId)?.contents.length) {
      return model.removeAnnotation(itemId);
    }

    setOpen(false);
  };

  return (
    <div>
      <div
        className="jgis-Annotation-Handler"
        onClick={() => setOpenOrDelete(!open)}
      ></div>
      <div
        className="jgis-FloatingAnnotation"
        style={{ visibility: open ? 'visible' : 'hidden' }}
      >
        <Annotation model={model} itemId={itemId}>
          <div className="jgis-Annotation-Topbar">
            <div
              onClick={async () => {
                // If the annotation has no content
                // we remove it right away without prompting
                if (!model.getAnnotation(itemId)?.contents.length) {
                  return model.removeAnnotation(itemId);
                }

                const result = await showDialog({
                  title: 'Delete Annotation',
                  body: 'Are you sure you want to delete this annotation?',
                  buttons: [
                    Dialog.cancelButton(),
                    Dialog.okButton({ label: 'Delete' })
                  ]
                });

                if (result.button.accept) {
                  model.removeAnnotation(itemId);
                }
              }}
            >
              <closeIcon.react className="jgis-Annotation-TopBarIcon" />
            </div>
            <div
              onClick={() => {
                setOpenOrDelete(false);
              }}
            >
              <minimizeIcon.react className="jgis-Annotation-TopBarIcon" />
            </div>
          </div>
        </Annotation>
      </div>
    </div>
  );
};
