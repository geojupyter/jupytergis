import { faArrowPointer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IDict, JgisCoordinates } from '@jupytergis/schema';
import React, { useEffect, useState } from 'react';

interface ICollaboratorPointersProps {
  clients: IDict<ClientPointer>;
  animated?: boolean;
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
  animated = true,
}) => {
  return (
    <>
      {clients &&
        Object.entries(clients).map(([clientId, client]) => (
          <div
            key={clientId}
            className={`jGIS-Popup-Wrapper jGIS-Remote-Pointer-Wrapper${animated ? ' jGIS-Remote-Pointer-Animated' : ''}`}
            style={{
              transform: `translate3d(${client.coordinates.x}px, ${client.coordinates.y}px, 0)`,
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
