import { faWindowMinimize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useState } from 'react';

import Annotation, { IAnnotationProps } from './Annotation';

const AnnotationFloater = ({
  itemId,
  annotationModel: model,
}: IAnnotationProps) => {
  const annotation = model.getAnnotation(itemId);
  const [isOpen, setIsOpen] = useState(annotation?.open);

  // Function that either
  // - opens the annotation if `open`
  // - removes the annotation if `!open` and the annotation is empty
  // - closes the annotation if `!open` and the annotation is not empty
  const setOpenOrDelete = (open: boolean) => {
    if (open) {
      model.updateAnnotation(itemId, { open: true });
      return setIsOpen(true);
    }

    const current = model.getAnnotation(itemId);
    if (!current?.contents.length) {
      model.removeAnnotation(itemId);
    } else {
      model.updateAnnotation(itemId, { open: false });
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
        <Annotation itemId={itemId} annotationModel={model}>
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
