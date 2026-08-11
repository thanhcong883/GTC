/* router.js
   Three views, three URLs:

     #/              Home
     #/usage         Usage & spend
     #/runs/competitor-research   the cost x-ray for one run

   Hash routing rather than clean paths, because this ships as static files in a
   subfolder: /day5/usage would 404 on refresh unless the host rewrites it,
   whereas /day5/#/usage is served by the same index.html every time. What you
   get either way is what matters — the back button works, a refresh keeps you
   where you were, and a view can be linked to.

   Anything with data-view (sidebar nav) or data-goto (a link or row inside a
   view) navigates; both go through the same route table. */

const ROUTES = [
  { key: 'home', hash: '#/',                          pane: 'view-home', nav: 'home', title: 'Home' },
  { key: 'dash', hash: '#/usage',                     pane: 'view-dash', nav: 'dash', title: 'Usage & spend' },
  // Run detail is reached from Usage, so that nav item stays lit while you're in it.
  { key: 'run',  hash: '#/runs/competitor-research',  pane: 'view-run',  nav: 'dash', title: 'Competitor Research · Notion' },
  { key: 'workflow', hash: '#/workflows',              pane: 'view-workflow', nav: 'dash', title: 'Workflow' },
];

const SITE = 'Console';
const byKey = (k) => ROUTES.find((r) => r.key === k);
const byHash = (h) => ROUTES.find((r) => r.hash === h);

export function initRouter() {
  function paint(route) {
    ROUTES.forEach((r) => {
      const pane = document.getElementById(r.pane);
      if (pane) pane.hidden = r.key !== route.key;
    });

    document.querySelectorAll('.nav button').forEach((b) => b.removeAttribute('aria-current'));
    const navButton = document.querySelector(`.nav button[data-view="${route.nav}"]`);
    if (navButton) navButton.setAttribute('aria-current', 'page');

    document.title = `${route.title} — ${SITE}`;
  }

  /** Read the URL and render whatever it names; unknown hashes fall back to Home. */
  function fromUrl() {
    const route = byHash(location.hash) || byKey('home');
    paint(route);
    return route;
  }

  /** Navigate by key. Pushes a history entry so Back returns to the previous view. */
  function go(key) {
    const route = byKey(key);
    if (!route || location.hash === route.hash) return;
    location.hash = route.hash;   // triggers hashchange -> fromUrl()
  }

  document.querySelectorAll('.nav button[data-view]').forEach((btn) =>
    btn.addEventListener('click', () => go(btn.dataset.view))
  );

  // Links carry a real href so they can be opened in a new tab or copied.
  document.querySelectorAll('[data-goto]').forEach((el) => {
    const route = byKey(el.dataset.goto);
    if (route && el.tagName === 'A') el.setAttribute('href', route.hash);
    el.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;  // let the browser handle new-tab
      e.preventDefault();
      go(el.dataset.goto);
      window.scrollTo({ top: 0 });
    });
  });

  window.addEventListener('hashchange', fromUrl);
  fromUrl();

  return { go };
}
