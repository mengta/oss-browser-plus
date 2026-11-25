export function readSnapshot() {
  if (typeof window === 'undefined' || !window.ossBrowser) {
    return null;
  }
  const res = window.ossBrowser.bootstrap.get();
  return res && res.ok ? res.data : null;
}

export const snapshot = readSnapshot();

export async function init() {
  const ready = typeof document !== 'undefined' ? document.readyState : 'complete';
  if (ready !== 'complete') {
    await new Promise((resolve) => {
      window.addEventListener('load', resolve, { once: true });
    });
  }
  return snapshot;
}