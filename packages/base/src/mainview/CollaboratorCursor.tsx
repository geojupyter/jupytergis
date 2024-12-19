import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import React, { useState } from 'react';

interface ICollaboratorCursorProps {
  clients: IDict<TransformedClient>;
}

export type TransformedClient = {
  username: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
};

const CollaboratorCursor = ({ clients }: ICollaboratorCursorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {clients &&
        Object.values(clients).map(client => (
          <div
            key={client.username}
            className="jGIS-Remote-Cursor"
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
              className="jGIS-Remote-Cursor-Icon"
            />
            <div
              style={{
                visibility: isOpen ? 'visible' : 'hidden',
                background: client.color
              }}
              className="jGIS-Remote-Cursor-Popup"
            >
              {client.displayName}
              <br />
              Cursor at:
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

export default CollaboratorCursor;
