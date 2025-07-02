import { faWindowMinimize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useState } from 'react';

import Annotation, { IAnnotationProps } from './Annotation';

const AnnotationFloater: React.FC<IAnnotationProps> = props => {
  const annotation = props.annotationModel.getAnnotation(props.itemId);
  const [isOpen, setIsOpen] = useState(annotation?.open);

  // Function that either
  // - opens the annotation if `open`
  // - removes the annotation if `!open` and the annotation is empty
  // - closes the annotation if `!open` and the annotation is not empty
  const setOpenOrDelete = (open: boolean) => {
    if (open) {
      props.annotationModel.updateAnnotation(props.itemId, { open: true });
      return setIsOpen(true);
    }

    const current = props.annotationModel.getAnnotation(props.itemId);
    if (!current?.contents.length) {
      props.annotationModel.removeAnnotation(props.itemId);
    } else {
      props.annotationModel.updateAnnotation(props.itemId, { open: false });
      setIsOpen(false);
    }
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
        <Annotation itemId={props.itemId} annotationModel={props.annotationModel}>
          <div
            className="jGIS-Popup-Topbar"
            onClick={() => {
              setOpenOrDelete(false);
            }}
          >
            <FontAwesomeIcon
              icon={faWindowMinimize}
              className="jGIS-Popup-TopBarIcon"
            />
          </div>
        </Annotation>
      </div>
    </>
  );
};

export default AnnotationFloater;
