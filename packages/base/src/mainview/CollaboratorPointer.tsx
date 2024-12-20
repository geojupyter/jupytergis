import {
  faArrowPointer,
  faWindowMinimize
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import React, { useState } from 'react';

interface ICollaboratorPointerProps {
  clients: IDict<TransformedClientPointer>;
}

export type TransformedClientPointer = {
  username: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
};

const CollaboratorPointer = ({ clients }: ICollaboratorPointerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {clients &&
        Object.values(clients).map(client => (
          <div
            className="jGIS-Popup-Wrapper"
            style={{
              left: `${client.x}px`,
              top: `${client.y}px`
            }}
          >
            <div
              key={client.username}
              className="jGIS-Remote-Pointer"
              style={{
                color: client.color,
                cursor: 'pointer'
              }}
              onClick={() => {
                setIsOpen(!isOpen);
              }}
            >
              <FontAwesomeIcon
                icon={faArrowPointer}
                className="jGIS-Remote-Pointer-Icon"
              />
            </div>
            <div
              style={{
                visibility: isOpen ? 'visible' : 'hidden',
                background: client.color
              }}
              className="jGIS-Remote-Pointer-Popup jGIS-Floating-Pointer-Popup"
            >
              <div
                className="jGIS-Popup-Topbar"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <FontAwesomeIcon
                  icon={faWindowMinimize}
                  className="jGIS-Popup-TopBarIcon"
                />
              </div>
              <div className="jGIS-Remote-Pointer-Popup-Name">
                {client.displayName}
              </div>
              <div className="jGIS-Remote-Pointer-Popup-Coordinates">
                <br />
                Pointer Location:
                <br />
                x: {client.x.toFixed(2)}
                <br />
                y: {client.y.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
    </>
  );
};

export default CollaboratorPointer;
