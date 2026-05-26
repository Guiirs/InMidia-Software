const NS = 'v4:map:bus';

export const mapBus = {
  emit(type, detail = {}) {
    window.dispatchEvent(new CustomEvent(`${NS}:${type}`, { detail }));
  },
  on(type, handler) {
    window.addEventListener(`${NS}:${type}`, handler);
  },
  off(type, handler) {
    window.removeEventListener(`${NS}:${type}`, handler);
  },
};
