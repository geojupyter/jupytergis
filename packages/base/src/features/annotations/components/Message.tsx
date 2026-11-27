import { User } from '@jupyterlab/services';
import React, { useEffect, useState } from 'react';

interface IProps {
  /*
   * The message content.
   **/
  message: string;

  /*
   * Whether the message was originated from the current user.
   **/
  self: boolean;

  /*
   * The user who originated the message.
   **/
  user?: User.IIdentity;
}

export const Message: React.FC<IProps> = props => {
  const { self, message, user } = props;
  const color = user?.color ?? 'black';
  const author = user?.display_name ?? '';
  const initials = user?.initials ?? '';
  const avatarUrl = user?.avatar_url;
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => setAvatarFailed(false), [avatarUrl]);

  const showAvatar = !!avatarUrl && !avatarFailed;

  return (
    <div
      className="jGIS-Annotation-Message"
      style={{
        flexFlow: self ? 'row' : 'row-reverse',
      }}
    >
      <div
        className="jGIS-Annotation-User-Icon"
        style={{
          backgroundColor: showAvatar ? undefined : color,
        }}
        title={author}
      >
        {showAvatar ? (
          <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
        ) : (
          <span style={{ width: 24, textAlign: 'center' }}>{initials}</span>
        )}
      </div>
      <div className="jGIS-Annotation-Message-Content">
        <p style={{ padding: 7, margin: 0 }}>{message}</p>
      </div>
    </div>
  );
};
