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

  return (
    <>
      {clients &&
        Object.values(clients).map(client => (
          <div key={client.username} className="jGIS-Annotation-Handler">
            {client.displayName}
          </div>
        ))}
    </>
  );
};

export default CollaboratorCursor;
