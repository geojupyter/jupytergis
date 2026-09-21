import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { collaboratorPill } from '@jupyter/collaboration';
import { IDict, JgisCoordinates } from '@jupytergis/schema';
import { User } from '@jupyterlab/services';
import React, { useEffect, useRef } from 'react';

interface ICollaboratorPointersProps {
  clients: IDict<ClientPointer>;
}

export type ClientPointer = {
  user: User.IIdentity;
  coordinates: JgisCoordinates;
  lonLat: { latitude: number; longitude: number };
};

const CollaboratorPill: React.FC<{ user: User.IIdentity }> = ({ user }) => {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    host.current?.replaceChildren(collaboratorPill(user));
    // Rebuild only when what the pill renders changes, not on every pointer move.
  }, [user.display_name, user.initials, user.avatar_url, user.color]);

  return <div className="jGIS-Remote-Pointer-Pill-Host" ref={host} />;
};

const CollaboratorPointers: React.FC<ICollaboratorPointersProps> = ({
  clients,
}) => {
  return (
    <>
      {clients &&
        Object.entries(clients).map(([clientId, client]) => (
          <div
            key={clientId}
            className="jGIS-Popup-Wrapper jGIS-Remote-Pointer-Wrapper"
            style={{
              transform: `translate3d(${client.coordinates.x}px, ${client.coordinates.y}px, 0)`,
            }}
          >
            <div
              className="jGIS-Remote-Pointer"
              style={{ color: client.user.color }}
            >
              <FontAwesomeIcon
                icon={faArrowPointer}
                className="jGIS-Remote-Pointer-Icon"
              />
              <CollaboratorPill user={client.user} />
            </div>
          </div>
        ))}
    </>
  );
};

export default CollaboratorPointers;
