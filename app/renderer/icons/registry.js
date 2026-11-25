export const FALLBACK_PATH = 'M4 4h16v16H4V4zm2 2v12h12V6H6z';

export const ICON_PATHS = {
  'question-circle':
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-13a3 3 0 0 0-3 3h2a1 1 0 1 1 1.6.8c-.9.7-1.6 1.4-1.6 2.7v.5h2v-.5c0-.6.3-.9.9-1.4.9-.7 1.1-1.4 1.1-2.1A3 3 0 0 0 12 7zm-1 10h2v2h-2v-2z',
  'cloud-download':
    'M19 18H5a3 3 0 0 1-.4-6A5.5 5.5 0 0 1 15 9.5 3.5 3.5 0 0 1 19 18zM12 8v6.5l2-2 1.4 1.4L12 17.3l-3.4-3.4L10 12.5l2 2V8h0z',
  eye: 'M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zm0 2c-3.5 0-6.6 3-7.8 5 1.2 2 4.3 5 7.8 5s6.6-3 7.8-5C18.6 10 15.5 7 12 7zm0 1.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  'eye-slash':
    'M3.3 2L2 3.3 5.6 6.9A11.6 11.6 0 0 0 3 12c0 2.5 4 7 9 7 2.2 0 4.2-.8 5.7-2.1L20.7 21 22 19.7l-4-4L3.3 2zM12 5c5 0 9 4.5 9 7a8.6 8.6 0 0 1-2 3.6l-2.7-2.7A3.5 3.5 0 0 0 11.1 9L8.4 6.3A9 9 0 0 1 12 5z',
  warning: 'M12 3l10 18H2L12 3zm0 4.5L5.3 19h13.4L12 7.5zM11 11h2v5h-2v-5zm0 6h2v2h-2v-2z',
  check: 'M9.5 17.5L4 12l1.4-1.4 4.1 4.1L18.6 5.6 20 7 9.5 17.5z',
  trash:
    'M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z',
  search:
    'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm6.1 9.3L21 19.7 19.7 21l-4.4-4.4 1.3-1.3z',
  inbox:
    'M4 4h16v16H4V4zm2 2v8h3l1 2h4l1-2h3V6H6zm2 10H6v2h12v-2h-2l-1 2h-4l-1-2z',
  history:
    'M12 3a9 9 0 1 1-8.5 6H2V5h2l-.9 2A7 7 0 1 0 12 5c-1.9 0-3.6.8-4.8 2.1L9 9H4V4l1.7 1.7A9 9 0 0 1 12 3zm-1 5h2v5.4l3.2 1.9-1 1.7-4.2-2.5V8z',
  fallback: FALLBACK_PATH,
};

export const ICON_NAMES = Object.keys(ICON_PATHS);

export const AUTH_ICON_NAMES = [
  'question-circle',
  'cloud-download',
  'eye',
  'eye-slash',
  'warning',
  'check',
  'trash',
  'search',
  'inbox',
  'history',
];

export function getIconPath(name) {
  return ICON_PATHS[name] || FALLBACK_PATH;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_PATHS, name) && name !== 'fallback';
}