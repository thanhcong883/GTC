/* theme.js
   Light and dark are two separately chosen palettes, both validated against
   their own surface — see css/tokens.css. This module only decides which one
   is active and keeps the toggle's label honest.

   The initial value is applied by an inline script in index.html, before first
   paint, so a dark-mode user never sees a white flash. */

const SUN = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13m7.64 7.64 1.13 1.13m0-9.9-1.13 1.13m-7.64 7.64-1.13 1.13"/></svg>';
const MOON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 9.5A5.6 5.6 0 0 1 6.5 2.5a5.6 5.6 0 1 0 7 7z"/></svg>';

const root = document.documentElement;
const isDark = () => root.getAttribute('data-theme') === 'dark';

export function initTheme() {
  const button = document.querySelector('.me .moon');
  if (!button) return;

  const paint = () => {
    const dark = isDark();
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    button.innerHTML = dark ? SUN : MOON;
  };

  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    paint();
  });

  paint();
}
