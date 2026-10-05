/**
 * Turn a connection failure into something the user can act on. A browser
 * refuses to tell a page why a cross-origin request was rejected, so the
 * axios "Network Error" we get back has to be spelled out rather than
 * repeated verbatim.
 */
export function describeConnectionError(error: any, url: string): string {
  const response = error?.response;
  if (response?.status) {
    const status = [response.status, response.statusText]
      .filter(Boolean)
      .join(' ');
    return `${url} answered ${status}: ${error.message}`;
  }

  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return `${url} did not answer in time. The server may be overloaded or unreachable.`;
  }

  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return (
      `The browser could not reach ${url} and will not say why. ` +
      `Either the server is down, or it does not allow requests coming from ${globalThis.location?.origin ?? 'this page'} (CORS). ` +
      'The Network tab of your browser developer tools shows the real reason.'
    );
  }

  return error?.message ?? String(error);
}
