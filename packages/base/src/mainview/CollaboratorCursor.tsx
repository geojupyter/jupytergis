import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict } from '@jupytergis/schema';
import React from 'react';

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
              color: client.color
            }}
          >
            <FontAwesomeIcon icon={faArrowPointer} />
          </div>
        ))}
    </>
  );
};

export default CollaboratorCursor;
