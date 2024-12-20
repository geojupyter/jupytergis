import React, { useState } from 'react';
import { faWindowMinimize } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Annotation, { IAnnotationProps } from './Annotation';

interface IAnnotationFloaterProps extends IAnnotationProps {
  open: boolean;
}

const AnnotationFloater = ({
  itemId,
  annotationModel: model,
  open
}: IAnnotationFloaterProps) => {
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
