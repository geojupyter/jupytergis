import { Dialog, ReactWidget } from '@jupyterlab/apputils';
import { AuthProvider, Connection } from '@openeo/js-client';
import React from 'react';

import { IDeviceCode, OpenEODeviceProvider } from './deviceLogin';

const ANONYMOUS = -1;

export interface IOpenEOSigninProps {
  providers: AuthProvider[];
  /** Shown in the heading, e.g. the server's own name. */
  serverTitle?: string;
  /** Offer "No credentials", like editor.openeo.org does. */
  allowAnonymous?: boolean;
  onSignedIn: (anonymous: boolean) => void;
  /** Renders a "Switch server" link when the caller can go back. */
  onSwitchServer?: () => void;
}

function providerLabel(provider: AuthProvider): string {
  return (
    provider.getTitle() ||
    (provider.getType() === 'basic'
      ? 'Username and password'
      : 'OpenID Connect')
  );
}

/**
 * Sign in with any of the methods the OpenEO server lists: username and
 * password, an OpenID Connect provider through the device flow, or no
 * credentials at all. Laid out like the login step of editor.openeo.org.
 */
export function OpenEOSignin({
  providers,
  serverTitle,
  allowAnonymous = false,
  onSignedIn,
  onSwitchServer,
}: IOpenEOSigninProps): React.ReactElement {
  const [providerIndex, setProviderIndex] = React.useState(
    providers.length ? 0 : ANONYMOUS,
  );
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [code, setCode] = React.useState<IDeviceCode | null>(null);
  const abort = React.useRef(new AbortController());
  React.useEffect(() => () => abort.current.abort(), []);

  if (!providers.length && !allowAnonymous) {
    return (
      <div>This server offers no sign-in method that JupyterGIS supports.</div>
    );
  }

  const provider = providers[providerIndex];
  const isAnonymous = providerIndex === ANONYMOUS;
  const isBasic = provider?.getType() === 'basic';

  const signIn = async () => {
    if (isAnonymous) {
      onSignedIn(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (provider instanceof OpenEODeviceProvider) {
        await provider.login(setCode, abort.current.signal);
      } else {
        await provider?.login(username, password);
      }
      onSignedIn(false);
    } catch (err) {
      if (!abort.current.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setCode(null);
      setBusy(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username && password) {
      e.preventDefault();
      void signIn();
    }
  };

  const pick = (index: number) => {
    setProviderIndex(index);
    setError(null);
  };

  const action = isAnonymous
    ? 'Continue without logging in'
    : isBasic
      ? 'Log in'
      : provider
        ? `Log in with ${providerLabel(provider)}`
        : 'Log in';

  return (
    <div className="jp-openeo-signin">
      <h3 className="jp-openeo-signin-title">
        Log in to {serverTitle || 'the openEO server'}
      </h3>

      <div className="jp-openeo-signin-methods">
        {providers.map((p, i) => (
          <button
            key={`${p.getId()}-${i}`}
            type="button"
            className={
              'jp-openeo-pill' + (i === providerIndex ? ' jp-mod-selected' : '')
            }
            onClick={() => pick(i)}
            disabled={busy}
          >
            {providerLabel(p)}
          </button>
        ))}
        {allowAnonymous && (
          <button
            type="button"
            className={
              'jp-openeo-pill' + (isAnonymous ? ' jp-mod-selected' : '')
            }
            onClick={() => pick(ANONYMOUS)}
            disabled={busy}
          >
            No credentials
          </button>
        )}
      </div>

      {!isAnonymous && (
        <label className="jp-openeo-field">
          <span>Login method</span>
          <select className="jp-mod-styled" disabled>
            <option>
              {isBasic
                ? 'User Credentials (default)'
                : 'Device Code Flow (default)'}
            </option>
          </select>
        </label>
      )}

      {isBasic && (
        <>
          <label className="jp-openeo-field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={onEnter}
              disabled={busy}
            />
          </label>
          <label className="jp-openeo-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onEnter}
              disabled={busy}
            />
          </label>
        </>
      )}

      <p className="jp-openeo-signin-note">
        {isAnonymous
          ? 'You can browse the collections and processes this server offers, but adding a layer needs a session.'
          : isBasic
            ? 'Your credentials are sent to the server you entered above.'
            : 'You get a link and a short code to enter on the provider’s site. This step finishes once you are signed in there.'}
      </p>

      {code && (
        <div className="jp-openeo-signin-code">
          Open{' '}
          <a href={code.verificationUri} target="_blank" rel="noreferrer">
            {code.verificationUri}
          </a>{' '}
          and enter the code <code>{code.userCode}</code>.
        </div>
      )}

      {error && (
        <div className="jp-openeo-server-alert jp-mod-error">{error}</div>
      )}

      <div className="jp-openeo-signin-actions">
        <button
          type="button"
          className="jp-openeo-server-connect"
          onClick={signIn}
          disabled={
            busy ||
            (!provider && !isAnonymous) ||
            (isBasic && (!username || !password))
          }
        >
          {busy ? 'Signing in…' : action}
        </button>
      </div>

      {onSwitchServer && (
        <button
          type="button"
          className="jp-openeo-link-btn"
          onClick={onSwitchServer}
          disabled={busy}
        >
          Switch server
        </button>
      )}
    </div>
  );
}

/**
 * Show the sign-in form in a dialog, for the callers that have nowhere to
 * render it inline. Resolves to `true` once the user is signed in, `false`
 * if they cancel.
 */
export async function showOpenEOSigninDialog(
  providers: AuthProvider[],
  connection?: Connection,
): Promise<boolean> {
  let signedIn = false;
  const dialog = new Dialog({
    title: 'Sign in to OpenEO',
    body: ReactWidget.create(
      <OpenEOSignin
        providers={providers}
        serverTitle={connection?.capabilities().title()}
        onSignedIn={() => {
          signedIn = true;
          dialog.resolve();
        }}
      />,
    ),
    buttons: [Dialog.cancelButton()],
  });
  await dialog.launch();
  return signedIn;
}
