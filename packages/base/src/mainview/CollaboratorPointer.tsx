import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
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
            key={client.username}
            className="jGIS-Remote-Pointer"
            style={{
              left: `${client.x}px`,
              top: `${client.y}px`,
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
            <div
              style={{
                visibility: isOpen ? 'visible' : 'hidden',
                background: client.color
              }}
              className="jGIS-Remote-Pointer-Popup"
            >
              {client.displayName}
              <br />
              Pointer at:
              <br />
              x: {client.x},
              <br />
              y: {client.y}
            </div>
          </div>
        ))}
    </>
  );
};

export default CollaboratorPointer;
