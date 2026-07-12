// @ts-check

/**
 * Dev-only: forwards uncaught errors to tools/serve.py so they surface in the
 * terminal instead of only in a browser console. No-op on the real site.
 */

const LOCAL = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/;

/** @param {string} name @param {boolean} ok */
function report(name, ok) {
  fetch('/__report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      suite: 'runtime',
      ua: navigator.userAgent,
      results: [{ name, ok }],
    }),
  }).catch(() => {});
}

export function installDevReporter() {
  if (!LOCAL.test(location.hostname)) return;

  window.addEventListener('error', (e) => {
    const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '';
    report(`${e.message}${where}`, false);
  });

  window.addEventListener('unhandledrejection', (e) => {
    report(`unhandled rejection: ${e.reason}`, false);
  });

  report('boot: no uncaught errors', true);
}
