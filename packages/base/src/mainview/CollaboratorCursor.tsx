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
            className="jGIS-Annotation-Handler"
            style={{
              left: `${client.x}px`,
              top: `${client.y}px`,
              background: client.color,
              zIndex: 1000
            }}
          >
            {client.displayName}
          </div>
        ))}
    </>
  );
};

export default CollaboratorCursor;
