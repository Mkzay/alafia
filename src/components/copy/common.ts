/** Shared UI copy. Every user-facing string lives under src/components/copy (U13.4). */
export const APP_NAME = 'Alafia';
export const APP_DESCRIPTION = 'Turn your daily moves, meals and rest into a game character that levels up.';

export const NAV = {
  label: 'Main',
  home: 'Home',
  history: 'History',
  settings: 'Settings',
  log: 'Log',
  skipToContent: 'Skip to content',
} as const;

export const SCREEN_TITLES = {
  home: 'Your character',
  log: 'Log a quest',
  history: 'History',
  settings: 'Settings',
} as const;

export const LOADING = {
  label: 'Loading your character',
} as const;

export const ERRORS = {
  title: 'Something went wrong',
  body: 'This screen hit a snag. Your logs are safe on this device.',
  retry: 'Try again',
  home: 'Go home',
  notFoundTitle: 'Page not found',
  notFoundBody: "We couldn't find that page.",
} as const;

export const OFFLINE_PAGE = {
  title: "You're offline",
  body: 'This page needs a connection the first time you open it. Your logs are safe on this device.',
  home: 'Back to Home',
} as const;

export const PLACEHOLDER = {
  comingSoon: 'Coming soon.',
} as const;
