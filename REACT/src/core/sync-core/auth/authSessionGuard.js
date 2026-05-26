export function hasValidSyncSession(auth) {
  return Boolean(auth?.token || localStorage.getItem('token')) && auth?.isAuthenticated && !auth?.sessionExpired;
}

export function authFailureStatus(error) {
  const status = error?.response?.status || error?.statusCode;
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  return null;
}
