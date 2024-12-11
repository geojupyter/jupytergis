import { IAnnotationModel } from '@jupytergis/schema';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { Button, deleteIcon } from '@jupyterlab/ui-components';
import React, { useMemo, useState } from 'react';
import { minimizeIcon } from '../../icons';
import { Message } from './Message';
import {
  faPaperPlane,
  faTrash,
  faWindowMinimize
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Annotation, { IAnnotationProps } from './Annotation';

interface IAnnotationFloaterProps extends IAnnotationProps {
  open: boolean;
}

const AnnotationFloater = ({
  itemId,
  model,
  open
}: IAnnotationFloaterProps) => {
  //   const { itemId, model } = props;

  const [isOpen, setIsOpen] = useState(open);

  // Function that either
  // - opens the annotation if `open`
  // - removes the annotation if `!open` and the annotation is empty
  // - closes the annotation if `!open` and the annotation is not empty
  const setOpenOrDelete = (open: boolean) => {
    if (open) {
      return setIsOpen(true);
    }

    if (!model.getAnnotation(itemId)?.contents.length) {
      return model.removeAnnotation(itemId);
    }

    setIsOpen(false);
  };

  return (
    <>
      <div
        className="jGIS-Annotation-Handler"
        onClick={() => setOpenOrDelete(!isOpen)}
      ></div>
      <div
        className="jGIS-FloatingAnnotation"
        style={{ visibility: isOpen ? 'visible' : 'hidden' }}
      >
        <Annotation itemId={itemId} model={model}>
          <div
            className="jGIS-Annotation-Topbar"
            onClick={() => {
              setOpenOrDelete(false);
            }}
          >
            <FontAwesomeIcon
              icon={faWindowMinimize}
              className="jGIS-Annotation-TopBarIcon"
            />
          </div>
        </Annotation>
      </div>
    </>
  );
};

export default AnnotationFloater;
