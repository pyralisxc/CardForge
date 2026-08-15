export const CARDFORGE_AUTH_READY_EVENT = 'cardforge:auth-ready';

export const announceCardForgeAuthReady = (): void => {
  window.dispatchEvent(new Event(CARDFORGE_AUTH_READY_EVENT));
};
