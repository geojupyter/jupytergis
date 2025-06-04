import {
  faArrowPointer,
  faWindowMinimize,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict, JgisCoordinates } from '@jupytergis/schema';
import React, { useState } from 'react';

interface ICollaboratorPointersProps {
  clients: IDict<ClientPointer>;
}

export type ClientPointer = {
  username: string;
  displayName: string;
  color: string;
  coordinates: JgisCoordinates;
  lonLat: { latitude: number; longitude: number };
};

const CollaboratorPointers = ({ clients }: ICollaboratorPointersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {clients &&
        Object.values(clients).map(client => (
          <div
            className="jGIS-Popup-Wrapper"
            style={{
              left: `${client.coordinates.x}px`,
              top: `${client.coordinates.y}px`,
            }}
          >
            <div
              key={client.username}
              className="jGIS-Remote-Pointer"
              style={{
                color: client.color,
                cursor: 'pointer',
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
                background: client.color,
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
                Longitude: {client.lonLat.longitude.toFixed(2)}
                <br />
                Latitude: {client.lonLat.latitude.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
    </>
  );
};

export default CollaboratorPointers;
