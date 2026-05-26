export function createAuthSyncState() {
  let blocked = false;
  return {
    block() {
      blocked = true;
    },
    unblock() {
      blocked = false;
    },
    isBlocked() {
      return blocked;
    },
  };
}
