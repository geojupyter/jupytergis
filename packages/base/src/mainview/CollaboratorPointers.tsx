import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict, JgisCoordinates } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface ICollaboratorPointersProps {
  clients: IDict<ClientPointer>;
}

export type ClientPointer = {
  username: string;
  displayName: string;
  initials: string;
  avatarUrl?: string;
  color: string;
  coordinates: JgisCoordinates;
  lonLat: { latitude: number; longitude: number };
};

const CollaboratorAvatar: React.FC<{ client: ClientPointer }> = ({
  client,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => setAvatarFailed(false), [client.avatarUrl]);

  const showAvatar = !!client.avatarUrl && !avatarFailed;

  return (
    <div
      className="jGIS-Remote-Pointer-Avatar"
      style={{ backgroundColor: showAvatar ? undefined : client.color }}
      title={client.displayName}
    >
      {showAvatar ? (
        <img
          src={client.avatarUrl}
          alt=""
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <span>{client.initials}</span>
      )}
    </div>
  );
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
            className="jGIS-Popup-Wrapper"
            style={{
              left: `${client.coordinates.x}px`,
              top: `${client.coordinates.y}px`,
            }}
          >
            <div
              className="jGIS-Remote-Pointer"
              style={{ color: client.color }}
            >
              <FontAwesomeIcon
                icon={faArrowPointer}
                className="jGIS-Remote-Pointer-Icon"
              />
              <div
                className="jGIS-Remote-Pointer-Label"
                style={{ borderColor: client.color }}
              >
                <CollaboratorAvatar client={client} />
                <span className="jGIS-Remote-Pointer-Name">
                  {client.displayName}
                </span>
              </div>
            </div>
          </div>
        ))}
    </>
  );
};

export default CollaboratorPointers;
