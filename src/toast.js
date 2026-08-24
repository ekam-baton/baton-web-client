export const toast = {
  success: (msg) => window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'success', message: msg } })),
  error: (msg) => window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } })),
  info: (msg) => window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'info', message: msg } })),
};
