import {
  IDict,
  IJupyterGISClientState,
  IJupyterGISModel
} from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface ICollaboratorCursorProps {
  //   model: IJupyterGISModel;
  //   getPixelFromCoordinate: (coordinate: number[]) => number[];
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
  //   const [clients, setClients] = useState<TransformedClient[]>([]);

  //   useEffect(() => {
  //     const onClientSharedStateChanged = (
  //       sender: IJupyterGISModel,
  //       clients: Map<number, IJupyterGISClientState>
  //     ): void => {
  //       const transClients = [...clients.values()]
  //         .map(client => {
  //           const username = client.user.username;
  //           const displayName = client.user.display_name;
  //           const color = client.user.color;
  //           const coordinates = client.centerPosition.value?.coordinates;

  //           if (!coordinates) {
  //             return null;
  //           }

  //           const pixelCoords = getPixelFromCoordinate([
  //             coordinates.x,
  //             coordinates.y
  //           ]);

  //           return {
  //             username,
  //             displayName,
  //             color,
  //             x: pixelCoords[0],
  //             y: pixelCoords[1]
  //           };
  //         })
  //         .filter((client): client is TransformedClient => client !== null);

  //       setClients(transClients);
  //     };

  //     model.clientStateChanged.connect(onClientSharedStateChanged);

  //     return () => {
  //       model.clientStateChanged.disconnect(onClientSharedStateChanged);
  //     };
  //   }, []);

  // console.log('clients in comp', clients);

  const [coords, setCoords] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0
  });
  useEffect(() => {
    Object.values(clients).forEach(client => {
      // console.log('client', client.x, client.y);
      setCoords({ x: client.x, y: client.y });
    });

    // console.log('clients in comp effect', clients);
  }, [JSON.stringify(clients)]);

  useEffect(() => {
    console.log('coords', coords);
  }, [coords]);

  return (
    <>
      {clients &&
        Object.values(clients).map(client => (
          <div
            key={client.username}
            className="jGIS-Annotation-Handler"
            style={{
              left: `${coords.x}px`,
              top: `${coords.y}px`,
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
