// Which shell LAVA renders in.
//
// The Win98 `LAVA.exe` window only exists on the retro desktop, and only where
// there is room to drag it around. Everywhere else — phones, and the modern
// route at /assets/mnrv.html — LAVA opens as a full-bleed overlay instead.
//
// Pure: no DOM, no window object. The caller passes the width and path.

// Below this the retro window has nowhere to live.
const WINDOW_MIN_WIDTH = 768;

// The retro desktop, and nothing else.
const DESKTOP_PATHS = new Set(['/', '/index.html']);

/**
 * @param {number} viewportWidth
 * @param {string} pathname
 * @returns {'window' | 'overlay'}
 */
export function pickShell(viewportWidth, pathname) {
  if (!Number.isFinite(viewportWidth) || viewportWidth < WINDOW_MIN_WIDTH) return 'overlay';
  if (typeof pathname !== 'string') return 'overlay';
  // Tolerate a query string or hash on the desktop route.
  const path = pathname.split('?')[0].split('#')[0];
  return DESKTOP_PATHS.has(path) ? 'window' : 'overlay';
}
