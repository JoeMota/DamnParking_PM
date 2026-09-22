/* Shared nav + scroll styling */
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const nav = document.querySelector('.site-nav');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /** Normalize /about/index.html and /about/ to the same key. */
  function normalizePath(pathname) {
    let p = pathname.replace(/\/$/, '') || '/';
    if (p.endsWith('/index.html')) {
      p = p.slice(0, -'/index.html'.length) || '/';
    } else if (p === '/index.html') {
      p = '/';
    }
    return p;
  }

  const path = normalizePath(location.pathname);

  document.querySelectorAll('.nav-links a').forEach((a) => {
    try {
      const href = normalizePath(new URL(a.href).pathname);
      const isExact = href === path;
      const isSection = href !== '/' && path.startsWith(href + '/');
      if (isExact || isSection) {
        a.setAttribute('aria-current', 'page');
      }
    } catch (_) { /* ignore */ }
  });

  document.querySelectorAll('.subnav a').forEach((a) => {
    try {
      const href = normalizePath(new URL(a.href).pathname);
      if (href === path) {
        a.setAttribute('aria-current', 'page');
      }
    } catch (_) { /* ignore */ }
  });
})();
