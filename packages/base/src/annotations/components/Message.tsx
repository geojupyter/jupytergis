import { User } from '@jupyterlab/services';
import React from 'react';

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
  const color = props.user?.color ?? 'black';
  const author = props.user?.display_name ?? '';
  const initials = props.user?.initials ?? '';

  return (
    <div
      className="jGIS-Annotation-Message"
      style={{
        flexFlow: props.self ? 'row' : 'row-reverse',
      }}
    >
      <div
        className="jGIS-Annotation-User-Icon"
        style={{
          backgroundColor: color,
        }}
        title={author}
      >
        <span style={{ width: 24, textAlign: 'center' }}>{initials}</span>
      </div>
      <div className="jGIS-Annotation-Message-Content">
        <p style={{ padding: 7, margin: 0 }}>{props.message}</p>
      </div>
    </div>
  );
};
